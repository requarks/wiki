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
      return WIKI.db.groups.query().select(
        'groups.*',
        WIKI.db.groups.relatedQuery('users').count().as('userCount')
      )
    },
    async single(obj, args, context, info) {
      return WIKI.db.groups.query().findById(args.id)
    }
  },
  PageMutation: {
    async create(obj, args) {
      const group = await WIKI.db.pages.query().insertAndFetch({
        name: args.name
      })
      return {
        responseResult: graphHelper.generateSuccess('Group created successfully.'),
        group
      }
    },
    async delete(obj, args) {
      await WIKI.db.groups.query().deleteById(args.id)
      return {
        responseResult: graphHelper.generateSuccess('Group has been deleted.')
      }
    },
    async update(obj, args) {
      await WIKI.db.groups.query().patch({ name: args.name }).where('id', args.id)
      return {
        responseResult: graphHelper.generateSuccess('Group has been updated.')
      }
    }
  },
  Page: {
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
