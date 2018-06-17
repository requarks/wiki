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
      let localLocales = await WIKI.db.locales.query().select('id', 'code', 'isRTL', 'name', 'nativeName', 'createdAt', 'updatedAt')
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
        locale: WIKI.config.lang.code,
        autoUpdate: WIKI.config.lang.autoUpdate,
        namespacing: WIKI.config.lang.namespacing,
        namespaces: WIKI.config.lang.namespaces
      }
    }
  },
  LocalizationMutation: {
    async downloadLocale(obj, args, context) {
      try {
        const job = await WIKI.queue.job.fetchGraphLocale.add({
          locale: args.locale
        }, {
          timeout: 30000
        })
        await job.finished()
        return {
          responseResult: graphHelper.generateSuccess('Locale downloaded successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateLocale(obj, args, context) {
      try {
        WIKI.config.lang.code = args.locale
        WIKI.config.lang.autoUpdate = args.autoUpdate
        WIKI.config.lang.namespacing = args.namespacing
        WIKI.config.lang.namespaces = args.namespaces
        await WIKI.configSvc.saveToDb(['lang'])

        await WIKI.lang.setCurrentLocale(args.locale)
        await WIKI.lang.refreshNamespaces()

        return {
          responseResult: graphHelper.generateSuccess('Locale config updated')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
