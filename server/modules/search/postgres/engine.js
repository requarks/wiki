const tsquery = require('pg-tsquery')()

/* global WIKI */

module.exports = {
  async activate() {
    if (WIKI.config.db.type !== 'postgres') {
      throw new WIKI.Error.SearchActivationFailed('Must use PostgreSQL database to activate this engine!')
    }
  },
  async deactivate() {
    WIKI.logger.info(`(SEARCH/POSTGRES) Dropping index tables...`)
    await WIKI.models.knex.schema.dropTable('pagesWords')
    await WIKI.models.knex.schema.dropTable('pagesVector')
    WIKI.logger.info(`(SEARCH/POSTGRES) Index tables have been dropped.`)
  },
  /**
   * INIT
   */
  async init() {
    WIKI.logger.info(`(SEARCH/POSTGRES) Initializing...`)

    // -> Ensure pg_trgm extension is available (required for similarity search)
    await WIKI.models.knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    // -> Create Search Index
    const indexExists = await WIKI.models.knex.schema.hasTable('pagesVector')
    if (!indexExists) {
      WIKI.logger.info(`(SEARCH/POSTGRES) Creating Pages Vector table...`)
      await WIKI.models.knex.schema.createTable('pagesVector', table => {
        table.increments()
        table.string('path')
        table.string('locale')
        table.string('title')
        table.string('description')
        table.specificType('tokens', 'TSVECTOR')
        table.text('content')
        table.string('siteId')
      })
    }
    // -> Create Words Index
    const wordsExists = await WIKI.models.knex.schema.hasTable('pagesWords')
    if (!wordsExists) {
      WIKI.logger.info(`(SEARCH/POSTGRES) Creating Words Suggestion Index...`)
      await WIKI.models.knex.raw(`
        CREATE TABLE "pagesWords" AS
        SELECT word, sites."siteId"
        FROM (SELECT DISTINCT "siteId" FROM "pagesVector") AS sites,
        LATERAL ts_stat(
          'SELECT (to_tsvector(''simple'', "title") || to_tsvector(''simple'', "description") || to_tsvector(''simple'', "content")) AS tsvector_word
           FROM "pagesVector"
           WHERE "siteId" = ' || quote_literal(sites."siteId")
        )
        `)
      await WIKI.models.knex.raw(`CREATE INDEX "pageWords_idx" ON "pagesWords" USING GIN (word gin_trgm_ops)`)
    }

    WIKI.logger.info(`(SEARCH/POSTGRES) Initialization completed.`)
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    try {
      let suggestions = []
      let qry = `
        SELECT ('p' || "pagesVector".id::text) as id, path, locale, title, description
        FROM "pagesVector", to_tsquery(?,?) query
        WHERE (query @@ "tokens" OR path ILIKE ? OR title ILIKE ? OR description ILIKE ? OR content ILIKE ?)
          AND "siteId" = ?
      `
      let qryEnd = `ORDER BY ts_rank(tokens, query) DESC`
      let qryParams = [
        this.config.dictLanguage,
        tsquery(q),
        `%${q.toLowerCase()}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        opts.siteId
      ]

      if (opts.locale) {
        qry = `${qry} AND locale = ?`
        qryParams.push(opts.locale)
      }
      if (opts.path) {
        qry = `${qry} AND path ILIKE ?`
        qryParams.push(`%${opts.path}`)
      }
      const results = await WIKI.models.knex.raw(`
        ${qry}
        ${qryEnd}
      `, qryParams)

      // Search comment content (mentions in comments)
      let commentQry = `
        SELECT DISTINCT ('c' || p.id::text) as id, p.path, p."localeCode" as locale, p.title, p.description
        FROM comments c
        INNER JOIN pages p ON c."pageId" = p.id
        WHERE c.content ILIKE ?
          AND p."isPublished" = true
          AND p."siteId" = ?
      `
      let commentParams = [`%${q}%`, opts.siteId]

      if (opts.locale) {
        commentQry += ` AND p."localeCode" = ?`
        commentParams.push(opts.locale)
      }
      if (opts.path) {
        commentQry += ` AND p.path ILIKE ?`
        commentParams.push(`%${opts.path}`)
      }

      const commentResults = await WIKI.models.knex.raw(commentQry, commentParams)

      // Mark sources and merge
      results.rows.forEach(r => { r.source = 'page' })
      const commentRows = commentResults.rows.map(r => ({ ...r, source: 'comment' }))

      // Deduplicate by path+locale (prefer page results over comment results)
      const pageKeys = new Set(results.rows.map(r => `${r.path}::${r.locale}`))
      const uniqueComments = commentRows.filter(r => !pageKeys.has(`${r.path}::${r.locale}`))
      const allResults = [...results.rows, ...uniqueComments]

      if (results.rows.length < 5) {
        try {
          const suggestResults = await WIKI.models.knex.raw(`SELECT word, word <-> ? AS rank FROM "pagesWords" WHERE similarity(word, ?) > 0.2 AND "siteId" = ? ORDER BY rank LIMIT 5;`, [q, q, opts.siteId])
          suggestions = [...new Set(suggestResults.rows.map(r => r.word))]
        } catch (err) {
          WIKI.logger.warn(`Search Engine Suggestion Error (pg_trgm extension may be missing): ${err.message}`)
        }
      }
      return {
        results: allResults,
        suggestions,
        totalHits: allResults.length,
        siteId: opts.siteId
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error:')
      WIKI.logger.warn(err)
    }
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    await WIKI.models.knex.raw(`
      INSERT INTO "pagesVector" (path, locale, title, description, "tokens", content, "siteId") VALUES (
        ?, ?, ?, ?, (setweight(to_tsvector('${this.config.dictLanguage}', ?), 'A') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'B') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'C')), ?, ?
      )
    `, [page.path, page.localeCode, page.title, page.description, page.title, page.description, page.safeContent, page.safeContent, page.siteId])
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    await WIKI.models.knex.raw(`
      UPDATE "pagesVector" SET
        title = ?,
        description = ?,
        content = ?,
        tokens = (setweight(to_tsvector('${this.config.dictLanguage}', ?), 'A') ||
        setweight(to_tsvector('${this.config.dictLanguage}', ?), 'B') ||
        setweight(to_tsvector('${this.config.dictLanguage}', ?), 'C'))
      WHERE path = ? AND locale = ? AND "siteId" = ?
    `, [page.title, page.description, page.safeContent, page.title, page.description, page.safeContent, page.path, page.localeCode, page.siteId])
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await WIKI.models.knex('pagesVector').where({
      locale: page.localeCode,
      path: page.path,
      siteId: page.siteId
    }).del().limit(1)
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    await WIKI.models.knex('pagesVector').where({
      locale: page.localeCode,
      path: page.path,
      siteId: page.siteId
    }).update({
      locale: page.destinationLocaleCode,
      path: page.destinationPath,
      siteId: page.siteId
    })
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    WIKI.logger.info(`(SEARCH/POSTGRES) Rebuilding Index...`)
    await WIKI.models.knex('pagesVector').truncate()
    await WIKI.models.knex('pagesWords').truncate()

    const batchSize = 50
    let offset = 0
    let totalIndexed = 0

    while (true) {
      const pages = await WIKI.models.knex
        .column('path', 'localeCode', 'title', 'description', 'siteId', 'render')
        .select()
        .from('pages')
        .where({ isPublished: true, isPrivate: false })
        .limit(batchSize)
        .offset(offset)

      if (pages.length === 0) break

      WIKI.logger.info(`(SEARCH/POSTGRES) Indexing pages ${offset + 1} – ${offset + pages.length}...`)

      for (const page of pages) {
        try {
          const content = WIKI.models.pages.cleanHTML(page.render)
          await WIKI.models.knex.raw(`
            INSERT INTO "pagesVector" (path, locale, title, description, "tokens", content, "siteId") VALUES (
              ?, ?, ?, ?, (setweight(to_tsvector('${this.config.dictLanguage}', ?), 'A') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'B') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'C')), ?, ?
            )
          `, [page.path, page.localeCode, page.title, page.description, page.title, page.description, content, content, page.siteId])
          totalIndexed++
        } catch (err) {
          WIKI.logger.warn(`(SEARCH/POSTGRES) Failed to index page [${page.localeCode}] ${page.path}: ${err.message}`)
          WIKI.logger.warn(err)
        }
      }

      offset += batchSize
      if (pages.length < batchSize) break
    }

    WIKI.logger.info(`(SEARCH/POSTGRES) Indexed ${totalIndexed} pages. Building words index...`)

    await WIKI.models.knex.raw(`
      INSERT INTO "pagesWords" (word, "siteId")
      SELECT word, sites."siteId"
      FROM (SELECT DISTINCT "siteId" FROM "pagesVector") AS sites,
      LATERAL ts_stat(
        'SELECT (to_tsvector(''simple'', "title") || to_tsvector(''simple'', "description") || to_tsvector(''simple'', "content")) AS tsvector_word
        FROM "pagesVector"
        WHERE "siteId" = ' || quote_literal(sites."siteId")
      )
      `)

    WIKI.logger.info(`(SEARCH/POSTGRES) Index rebuilt successfully.`)
  }
}
