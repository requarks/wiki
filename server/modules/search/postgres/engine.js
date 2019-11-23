const tsquery = require('pg-tsquery')()
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)

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
      })
    }
    // -> Create Words Index
    const wordsExists = await WIKI.models.knex.schema.hasTable('pagesWords')
    if (!wordsExists) {
      WIKI.logger.info(`(SEARCH/POSTGRES) Creating Words Suggestion Index...`)
      await WIKI.models.knex.raw(`
        CREATE TABLE "pagesWords" AS SELECT word FROM ts_stat(
          'SELECT to_tsvector(''simple'', "title") || to_tsvector(''simple'', "description") || to_tsvector(''simple'', "content") FROM "pagesVector"'
        )`)
      await WIKI.models.knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')
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
      const results = await WIKI.models.knex.raw(`
        SELECT id, path, locale, title, description
        FROM "pagesVector", to_tsquery(?) query
        WHERE query @@ "tokens"
        ORDER BY ts_rank(tokens, query) DESC
      `, [tsquery(q)])
      if (results.rows.length < 5) {
        const suggestResults = await WIKI.models.knex.raw(`SELECT word, word <-> ? AS rank FROM "pagesWords" WHERE similarity(word, ?) > 0.2 ORDER BY rank LIMIT 5;`, [q, q])
        suggestions = suggestResults.rows.map(r => r.word)
      }
      return {
        results: results.rows,
        suggestions,
        totalHits: results.rows.length
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
      INSERT INTO "pagesVector" (path, locale, title, description, "tokens") VALUES (
        ?, ?, ?, ?, (setweight(to_tsvector('${this.config.dictLanguage}', ?), 'A') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'B') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'C'))
      )
    `, [page.path, page.localeCode, page.title, page.description, page.title, page.description, page.safeContent])
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
        tokens = (setweight(to_tsvector('${this.config.dictLanguage}', ?), 'A') ||
        setweight(to_tsvector('${this.config.dictLanguage}', ?), 'B') ||
        setweight(to_tsvector('${this.config.dictLanguage}', ?), 'C'))
      WHERE path = ? AND locale = ?
    `, [page.title, page.description, page.title, page.description, page.safeContent, page.path, page.localeCode])
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await WIKI.models.knex('pagesVector').where({
      locale: page.localeCode,
      path: page.path
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
      path: page.path
    }).update({
      locale: page.destinationLocaleCode,
      path: page.destinationPath
    })
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    WIKI.logger.info(`(SEARCH/POSTGRES) Rebuilding Index...`)
    await WIKI.models.knex('pagesVector').truncate()
    await WIKI.models.knex('pagesWords').truncate()

    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'render').select().from('pages').where({
        isPublished: true,
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          const content = WIKI.models.pages.cleanHTML(page.render)
          await WIKI.models.knex.raw(`
            INSERT INTO "pagesVector" (path, locale, title, description, "tokens", content) VALUES (
              ?, ?, ?, ?, (setweight(to_tsvector('${this.config.dictLanguage}', ?), 'A') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'B') || setweight(to_tsvector('${this.config.dictLanguage}', ?), 'C')), ?
            )
          `, [page.path, page.localeCode, page.title, page.description, page.title, page.description, content, content])
          cb()
        }
      })
    )

    await WIKI.models.knex.raw(`
      INSERT INTO "pagesWords" (word)
        SELECT word FROM ts_stat(
          'SELECT to_tsvector(''simple'', "title") || to_tsvector(''simple'', "description") || to_tsvector(''simple'', "content") FROM "pagesVector"'
        )
      `)

    WIKI.logger.info(`(SEARCH/POSTGRES) Index rebuilt successfully.`)
  }
}
