const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async pages() { return {} }
  },
  Mutation: {
    async pages() { return {} }
  },
  PageQuery: {
    /**
     * PAGE HISTORY
     */
    async history(obj, args, context, info) {
      return WIKI.models.pageHistory.getHistory({
        pageId: args.id,
        offsetPage: args.offsetPage || 0,
        offsetSize: args.offsetSize || 100
      })
    },
    /**
     * SEARCH PAGES
     */
    async search (obj, args, context) {
      if (WIKI.data.searchEngine) {
        const resp = await WIKI.data.searchEngine.query(args.query, args)
        return {
          ...resp,
          results: _.filter(resp.results, r => {
            return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
              path: r.path,
              locale: r.locale
            })
          })
        }
      } else {
        return {
          results: [],
          suggestions: [],
          totalHits: 0
        }
      }
    },
    /**
     * LIST PAGES
     */
    async list (obj, args, context, info) {
      let results = await WIKI.models.pages.query().column([
        'pages.id',
        'path',
        { locale: 'localeCode' },
        'title',
        'description',
        'isPublished',
        'isPrivate',
        'privateNS',
        'contentType',
        'createdAt',
        'updatedAt'
      ])
        .eagerAlgorithm(WIKI.models.Objection.Model.JoinEagerAlgorithm)
        .eager('tags(selectTags)', {
          selectTags: builder => {
            builder.select('tag')
          }
        })
        .modify(queryBuilder => {
          if (args.limit) {
            queryBuilder.limit(args.limit)
          }
          if (args.locale) {
            queryBuilder.where('localeCode', args.locale)
          }
          if (args.tags && args.tags.length > 0) {
            queryBuilder.whereIn('tags.tag', args.tags)
          }
          const orderDir = args.orderByDirection === 'DESC' ? 'desc' : 'asc'
          switch (args.orderBy) {
            case 'CREATED':
              queryBuilder.orderBy('createdAt', orderDir)
              break
            case 'PATH':
              queryBuilder.orderBy('path', orderDir)
              break
            case 'TITLE':
              queryBuilder.orderBy('title', orderDir)
              break
            case 'UPDATED':
              queryBuilder.orderBy('updatedAt', orderDir)
              break
            default:
              queryBuilder.orderBy('pages.id', orderDir)
              break
          }
        })
      results = _.filter(results, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).map(r => ({
        ...r,
        tags: _.map(r.tags, 'tag')
      }))
      if (args.tags && args.tags.length > 0) {
        results = _.filter(results, r => _.every(args.tags, t => _.includes(r.tags, t)))
      }
      return results
    },
    /**
     * FETCH SINGLE PAGE
     */
    async single (obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        return {
          ...page,
          locale: page.localeCode,
          editor: page.editorKey
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },
    /**
     * FETCH TAGS
     */
    async tags (obj, args, context, info) {
      return WIKI.models.tags.query().orderBy('tag', 'asc')
    },
    /**
     * FETCH PAGE TREE
     */
    async tree (obj, args, context, info) {
      let results = []
      let conds = {
        localeCode: args.locale,
        parent: (args.parent < 1) ? null : args.parent
      }
      switch (args.mode) {
        case 'FOLDERS':
          conds.isFolder = true
          results = await WIKI.models.knex('pageTree').where(conds)
          break
        case 'PAGES':
          await WIKI.models.knex('pageTree').where(conds).andWhereNotNull('pageId')
          break
        default:
          results = await WIKI.models.knex('pageTree').where(conds)
          break
      }
      return results.filter(r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.localeCode
        })
      }).map(r => ({
        ...r,
        parent: r.parent || 0,
        locale: r.localeCode
      }))
    }
  },
  PageMutation: {
    /**
     * CREATE PAGE
     */
    async create(obj, args, context) {
      try {
        const page = await WIKI.models.pages.createPage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page created successfully.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE PAGE
     */
    async update(obj, args, context) {
      try {
        const page = await WIKI.models.pages.updatePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been updated.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * MOVE PAGE
     */
    async move(obj, args, context) {
      try {
        await WIKI.models.pages.movePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been moved.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE PAGE
     */
    async delete(obj, args, context) {
      try {
        await WIKI.models.pages.deletePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been deleted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * FLUSH PAGE CACHE
     */
    async flushCache(obj, args, context) {
      try {
        await WIKI.models.pages.flushCache()
        return {
          responseResult: graphHelper.generateSuccess('Pages Cache has been flushed successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * MIGRATE ALL PAGES FROM SOURCE LOCALE TO TARGET LOCALE
     */
    async migrateToLocale(obj, args, context) {
      try {
        const count = await WIKI.models.pages.migrateToLocale(args)
        return {
          responseResult: graphHelper.generateSuccess('Migrated content to target locale successfully.'),
          count
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * REBUILD TREE
     */
    async rebuildTree(obj, args, context) {
      try {
        await WIKI.models.pages.rebuildTree()
        return {
          responseResult: graphHelper.generateSuccess('Page tree rebuilt successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  Page: {
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
