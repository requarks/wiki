const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async navigation () { return {} }
  },
  Mutation: {
    async navigation () { return {} }
  },
  NavigationQuery: {
    async tree (obj, args, context, info) {
      return WIKI.models.navigation.getTree({ cache: false, locale: 'all', bypassAuth: true })
    },
    config (obj, args, context, info) {
      return WIKI.config.nav
    }
  },
  NavigationMutation: {
    async updateTree (obj, args, context) {
      try {
        await WIKI.models.navigation.query().patch({
          config: args.tree
        }).where('key', 'site')
        for (const tree of args.tree) {
          await WIKI.cache.set(`nav:sidebar:${tree.locale}`, tree.items, 300)
        }

        return {
          responseResult: graphHelper.generateSuccess('Navigation updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateConfig (obj, args, context) {
      try {
        WIKI.config.nav = {
          mode: args.mode
        }
        await WIKI.configSvc.saveToDb(['nav'])

        return {
          responseResult: graphHelper.generateSuccess('Navigation config updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
