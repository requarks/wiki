const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async navigationTree (obj, args, context, info) {
      return WIKI.models.navigation.getTree({ cache: false, locale: 'all', bypassAuth: true })
    },
    navigationConfig (obj, args, context, info) {
      return WIKI.config.nav
    }
  },
  Mutation: {
    async updateNavigationTree (obj, args, context) {
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
    async updateNavigationConfig (obj, args, context) {
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
