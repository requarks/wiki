const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async navigation() { return {} }
  },
  Mutation: {
    async navigation() { return {} }
  },
  NavigationQuery: {
    async tree(obj, args, context, info) {
      return WIKI.models.navigation.getTree()
    }
  },
  NavigationMutation: {
    async updateTree(obj, args, context) {
      try {
        await WIKI.models.navigation.query().patch({
          config: args.tree
        }).where('key', 'site')

        return {
          responseResult: graphHelper.generateSuccess('Navigation updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
