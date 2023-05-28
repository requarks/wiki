import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import _ from 'lodash-es'

export default {
  Query: {
    async locales(obj, args, context, info) {
      let remoteLocales = await WIKI.cache.get('locales')
      let localLocales = await WIKI.db.locales.query().select('code', 'isRTL', 'language', 'name', 'nativeName', 'createdAt', 'updatedAt', 'completeness')
      remoteLocales = remoteLocales || localLocales
      return _.map(remoteLocales, rl => {
        let isInstalled = _.some(localLocales, ['code', rl.code])
        return {
          ...rl,
          isInstalled,
          installDate: isInstalled ? _.find(localLocales, ['code', rl.code]).updatedAt : null
        }
      })
    },
    localeStrings (obj, args, context, info) {
      return WIKI.db.locales.getStrings(args.locale)
    }
  },
  Mutation: {
    async downloadLocale(obj, args, context) {
      try {
        const job = await WIKI.scheduler.registerJob({
          name: 'fetch-graph-locale',
          immediate: true
        }, args.locale)
        await job.finished
        return {
          responseResult: generateSuccess('Locale downloaded successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async updateLocale(obj, args, context) {
      try {
        WIKI.config.lang.code = args.locale
        WIKI.config.lang.autoUpdate = args.autoUpdate
        WIKI.config.lang.namespacing = args.namespacing
        WIKI.config.lang.namespaces = _.union(args.namespaces, [args.locale])

        const newLocale = await WIKI.db.locales.query().select('isRTL').where('code', args.locale).first()
        WIKI.config.lang.rtl = newLocale.isRTL

        await WIKI.configSvc.saveToDb(['lang'])

        await WIKI.lang.setCurrentLocale(args.locale)
        await WIKI.lang.refreshNamespaces()

        await WIKI.cache.del('nav:locales')

        return {
          responseResult: generateSuccess('Locale config updated')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
