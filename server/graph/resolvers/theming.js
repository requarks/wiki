const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async theming() { return {} }
  },
  Mutation: {
    async theming() { return {} }
  },
  ThemingQuery: {
    async themes(obj, args, context, info) {
      return [{ // TODO
        key: 'default',
        title: 'Default',
        author: 'requarks.io'
      }]
    },
    async config(obj, args, context, info) {
      return {
        theme: WIKI.config.theming.theme,
        darkMode: WIKI.config.theming.darkMode
      }
    }
  },
  ThemingMutation: {
    async setConfig(obj, args, context, info) {
      try {
        WIKI.config.theming.theme = args.theme
        WIKI.config.theming.darkMode = args.darkMode
        await WIKI.configSvc.saveToDb(['theming'])

        return {
          responseResult: graphHelper.generateSuccess('Theme config updated')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
