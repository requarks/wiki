const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async localization() { return {} }
  },
  Mutation: {
    async localization() { return {} }
  },
  LocalizationQuery: {
    async locales(obj, args, context, info) {
      let remoteLocales = await WIKI.redis.get('locales')
      let localLocales = await WIKI.db.Locale.findAll({
        attributes: {
          exclude: ['strings']
        },
        raw: true
      })
      remoteLocales = (remoteLocales) ? JSON.parse(remoteLocales) : localLocales
      return _.map(remoteLocales, rl => {
        let isInstalled = _.some(localLocales, ['code', rl.code])
        return {
          ...rl,
          isInstalled,
          installDate: isInstalled ? _.find(localLocales, ['code', rl.code]).updatedAt : null
        }
      })
    },
    async config(obj, args, context, info) {
      return {
        locale: WIKI.config.site.lang,
        autoUpdate: WIKI.config.site.langAutoUpdate
      }
    }
  },
  LocalizationMutation: {
    async updateLocale(obj, args, context) {
      try {
        WIKI.config.site.lang = args.locale
        WIKI.config.site.langAutoUpdate = args.autoUpdate
        await WIKI.configSvc.saveToDb(['site'])

        await WIKI.lang.setCurrentLocale(args.locale)

        return {
          responseResult: graphHelper.generateSuccess('Login success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
