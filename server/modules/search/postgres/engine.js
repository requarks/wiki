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
    // -> Create Index
    const indexExists = await WIKI.models.knex.schema.hasTable('pagesVector')
    if (!indexExists) {
      await WIKI.models.knex.schema.createTable('pagesVector', table => {
        table.increments()
        table.string('path')
        table.string('locale')
        table.string('title')
        table.string('description')
        table.specificType('titleTk', 'TSVECTOR')
        table.specificType('descriptionTk', 'TSVECTOR')
        table.specificType('contentTk', 'TSVECTOR')
      })
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
      const results = await WIKI.models.knex.raw(`
        SELECT id, path, locale, title, description
        FROM "pagesVector", to_tsquery(?) query
        WHERE (query @@ "titleTk") OR (query @@ "descriptionTk") OR (query @@ "contentTk")
      `, [tsquery(q)])
      return {
        results: results.rows,
        suggestions: [],
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
      INSERT INTO "pagesVector" (path, locale, title, description, "titleTk", "descriptionTk", "contentTk") VALUES (
        '?', '?', '?', '?', to_tsvector('?'), to_tsvector('?'), to_tsvector('?')
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
        "titleTk" = to_tsvector('?'),
        "descriptionTk" = to_tsvector('?'),
        "contentTk" = to_tsvector('?')
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
      INSERT INTO "pagesVector" (path, locale, title, description, "titleTk", "descriptionTk", "contentTk")
        SELECT path, "localeCode" AS locale, title, description, to_tsvector(title) AS "titleTk", to_tsvector(description) AS "descriptionTk", to_tsvector(content) AS "contentTk"
        FROM "pages"
        WHERE pages."isPublished" AND NOT pages."isPrivate"`)
  }
}
