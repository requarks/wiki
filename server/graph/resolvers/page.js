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
    }
  },
  Page: {
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
