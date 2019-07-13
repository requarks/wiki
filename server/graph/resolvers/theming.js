const graphHelper = require('../../helpers/graph')
const _ = require('lodash')
const CleanCSS = require('clean-css')

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
      return _.pick(WIKI.config.theming, ['theme', 'iconset', 'darkMode', 'injectCSS', 'injectHead', 'injectBody'])
    }
  },
  ThemingMutation: {
    async setConfig(obj, args, context, info) {
      try {
        if (!_.isEmpty(args.injectCSS)) {
          args.injectCSS = new CleanCSS({
            inline: false
          }).minify(args.injectCSS).styles
        }

        WIKI.config.theming = {
          ...WIKI.config.theming,
          theme: args.theme,
          iconset: args.iconset,
          darkMode: args.darkMode,
          injectCSS: args.injectCSS || '',
          injectHead: args.injectHead || '',
          injectBody: args.injectBody || ''
        }

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
