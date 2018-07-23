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
    async list(obj, args, context, info) {
      return WIKI.db.pages.query().select(
        'pages.*',
        WIKI.db.pages.relatedQuery('users').count().as('userCount')
      )
    },
    async single(obj, args, context, info) {
      return WIKI.db.pages.query().findById(args.id)
    }
  },
  PageMutation: {
    async create(obj, args, context) {
      const page = await WIKI.db.pages.createPage({
        ...args,
        authorId: context.req.user.id
      })
      return {
        responseResult: graphHelper.generateSuccess('Page created successfully.'),
        page
      }
    },
    async delete(obj, args) {
      await WIKI.db.groups.query().deleteById(args.id)
      return {
        responseResult: graphHelper.generateSuccess('Page has been deleted.')
      }
    },
    async update(obj, args, context) {
      const page = await WIKI.db.pages.updatePage({
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
