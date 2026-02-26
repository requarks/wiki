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
    // Search page content
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
            builderSub.orWhere('content', 'ILIKE', `%${q}%`)
          } else {
            builderSub.where('title', 'LIKE', `%${q}%`)
            builderSub.orWhere('description', 'LIKE', `%${q}%`)
            builderSub.orWhere('path', 'LIKE', `%${q.toLowerCase()}%`)
            builderSub.orWhere('content', 'LIKE', `%${q}%`) 
          }
        })
      })
      .limit(WIKI.config.search.maxHits)

    // Search comment content (mentions in comments)
    const commentResults = await WIKI.models.pages.query()
      .column('pages.id', 'title', 'description', 'path', 'localeCode as locale')
      .withGraphJoined('tags')
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
      })
      .whereIn('pages.id',
        WIKI.models.knex.select('pageId').from('comments').where(function () {
          if (WIKI.config.db.type === 'postgres') {
            this.where('content', 'ILIKE', `%${q}%`)
          } else {
            this.where('content', 'LIKE', `%${q}%`)
          }
        })
      )
      .limit(WIKI.config.search.maxHits)

    // Mark sources
    results.forEach(r => { r.source = 'page' })
    commentResults.forEach(r => { r.source = 'comment' })

    // Merge and deduplicate (prefer page matches over comment matches)
    const pageIds = new Set(results.map(r => r.id))
    const uniqueCommentResults = commentResults.filter(r => !pageIds.has(r.id))
    const allResults = [...results, ...uniqueCommentResults].slice(0, WIKI.config.search.maxHits)

    return {
      results: allResults,
      suggestions: [],
      totalHits: allResults.length
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
