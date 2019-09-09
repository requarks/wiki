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
    async history(obj, args, context, info) {
      return WIKI.models.pageHistory.getHistory({
        pageId: args.id,
        offsetPage: args.offsetPage || 0,
        offsetSize: args.offsetSize || 100
      })
    },
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
    async tags (obj, args, context, info) {
      return WIKI.models.tags.query().orderBy('tag', 'asc')
    }
  },
  PageMutation: {
    async create(obj, args, context) {
      const page = await WIKI.models.pages.createPage({
        ...args,
        authorId: context.req.user.id
      })
      return {
        responseResult: graphHelper.generateSuccess('Page created successfully.'),
        page
      }
    },
    async delete(obj, args, context) {
      await WIKI.models.pages.deletePage({
        ...args,
        authorId: context.req.user.id
      })
      return {
        responseResult: graphHelper.generateSuccess('Page has been deleted.')
      }
    },
    async update(obj, args, context) {
      const page = await WIKI.models.pages.updatePage({
        ...args,
        authorId: context.req.user.id
      })
      return {
        responseResult: graphHelper.generateSuccess('Page has been updated.'),
        page
      }
    },
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
    }
  },
  Page: {
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
