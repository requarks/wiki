/* global WIKI */

module.exports = {
  activate() {
    // not used
  },
  deactivate() {
    // not used
  },
  /**
   * INIT
   */
  init() {
    // not used
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    const normalizedQuery = q.toLowerCase()
    const results = await WIKI.models.pages.query()
      .column('pages.id', 'title', 'description', 'path', 'localeCode as locale')
      .withGraphJoined('tags') // Adding page tags since they can be used to check resource access permissions
      .modifyGraph('tags', builder => {
        builder.select('tag')
      })
      .where(builder => {
        builder.where('isPublished', true)
        if (opts.locale) {
          builder.andWhere('localeCode', opts.locale)
        }
        if (opts.path) {
          builder.andWhere('path', 'like', `${opts.path}%`)
        }
        builder.andWhere(builderSub => {
          if (WIKI.config.db.type === 'postgres') {
            builderSub.where('title', 'ILIKE', `%${q}%`)
            builderSub.orWhere('description', 'ILIKE', `%${q}%`)
            builderSub.orWhere('path', 'ILIKE', `%${q.toLowerCase()}%`)
          } else {
            builderSub.where('title', 'LIKE', `%${q}%`)
            builderSub.orWhere('description', 'LIKE', `%${q}%`)
            builderSub.orWhere('path', 'LIKE', `%${q.toLowerCase()}%`)
          }
        })
      })
      .orderBy('pages.updatedAt', 'desc')
      .orderByRaw(`
        CASE
          WHEN LOWER(title) = ? THEN 400
          WHEN LOWER(title) LIKE ? THEN 300
          WHEN LOWER(description) LIKE ? THEN 200
          WHEN LOWER(path) LIKE ? THEN 100
          ELSE 0
        END DESC
      `, [
        normalizedQuery,
        `%${normalizedQuery}%`,
        `%${normalizedQuery}%`,
        `%${normalizedQuery}%`
      ])
      .limit(WIKI.config.search.maxHits)
    return {
      results,
      suggestions: [],
      totalHits: results.length
    }
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    // not used
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    // not used
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    // not used
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    // not used
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    // not used
  }
}
