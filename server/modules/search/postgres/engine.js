const _ = require('lodash')
const tsquery = require('pg-tsquery')()

module.exports = {
  async activate() {
    // not used
  },
  async deactivate() {
    // not used
  },
  /**
   * INIT
   */
  async init() {
    // -> Create Search Index
    const indexExists = await WIKI.models.knex.schema.hasTable('pagesVector')
    if (!indexExists) {
      await WIKI.models.knex.schema.createTable('pagesVector', table => {
        table.increments()
        table.string('path')
        table.string('locale')
        table.string('title')
        table.string('description')
        table.specificType('tokens', 'TSVECTOR')
      })
    }
    // -> Create Words Index
    const wordsExists = await WIKI.models.knex.schema.hasTable('pagesWords')
    if (!wordsExists) {
      await WIKI.models.knex.raw(`
        CREATE TABLE "pagesWords" AS SELECT word FROM ts_stat(
          'SELECT to_tsvector(''simple'', pages."title") || to_tsvector(''simple'', pages."description") || to_tsvector(''simple'', pages."content") FROM pages WHERE pages."isPublished" AND NOT pages."isPrivate"'
        )`)
      await WIKI.models.knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')
      await WIKI.models.knex.raw(`CREATE INDEX "pageWords_idx" ON "pagesWords" USING GIN (word gin_trgm_ops)`)
    }
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
      INSERT INTO "pagesVector" (path, locale, title, description, tokens) VALUES (
        '?', '?', '?', '?', (setweight(to_tsvector('${this.config.dictLanguage}', '?'), 'A') || setweight(to_tsvector('${this.config.dictLanguage}', '?'), 'B') || setweight(to_tsvector('${this.config.dictLanguage}', '?'), 'C'))
      )
    `, [page.path, page.locale, page.title, page.description, page.title, page.description, page.content])
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    await WIKI.models.knex.raw(`
      UPDATE "pagesVector" SET
        title = '?',
        description = '?',
        tokens = (setweight(to_tsvector('${this.config.dictLanguage}', '?'), 'A') ||
        setweight(to_tsvector('${this.config.dictLanguage}', '?'), 'B') ||
        setweight(to_tsvector('${this.config.dictLanguage}', '?'), 'C'))
      WHERE path = '?' AND locale = '?' LIMIT 1
    `, [page.title, page.description, page.title, page.description, page.content, page.path, page.locale])
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    await WIKI.models.knex('pagesVector').where({
      locale: page.locale,
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
      locale: page.locale,
      path: page.sourcePath
    }).update({
      locale: page.locale,
      path: page.destinationPath
    }).limit(1)
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    await WIKI.models.knex('pagesVector').truncate()
    await WIKI.models.knex.raw(`
      INSERT INTO "pagesVector" (path, locale, title, description, "tokens")
        SELECT path, "localeCode" AS locale, title, description,
          (setweight(to_tsvector('${this.config.dictLanguage}', title), 'A') ||
          setweight(to_tsvector('${this.config.dictLanguage}', description), 'B') ||
          setweight(to_tsvector('${this.config.dictLanguage}', content), 'C')) AS tokens
        FROM "pages"
        WHERE pages."isPublished" AND NOT pages."isPrivate"`)
  }
}
