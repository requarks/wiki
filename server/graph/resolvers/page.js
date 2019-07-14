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
        return WIKI.data.searchEngine.query(args.query, args)
      } else {
        return {
          results: [],
          suggestions: [],
          totalHits: 0
        }
      }
    },
    async list (obj, args, context, info) {
      return WIKI.models.pages.query().column([
        'id',
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
