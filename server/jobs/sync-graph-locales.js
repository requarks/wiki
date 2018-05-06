require('../core/worker')
const _ = require('lodash')
const { createApolloFetch } = require('apollo-fetch')

/* global WIKI */

WIKI.redis = require('../core/redis').init()
WIKI.db = require('../core/db').init()

const apollo = createApolloFetch({
  uri: 'https://graph.requarks.io'
})

module.exports = async (job) => {
  WIKI.logger.info('Syncing locales with Graph endpoint...')

  try {
    await WIKI.configSvc.loadFromDb(['site'])

    // -> Fetch locales list

    const respList = await apollo({
      query: `{
        localization {
          locales {
            code
            name
            nativeName
            isRTL
            createdAt
            updatedAt
          }
        }
      }`
    })
    const locales = _.sortBy(_.get(respList, 'data.localization.locales', []), 'name').map(lc => ({...lc, isInstalled: (lc.code === 'en')}))
    WIKI.redis.set('locales', JSON.stringify(locales))
    const currentLocale = _.find(locales, ['code', WIKI.config.site.lang])

    // -> Download locale strings

    if (WIKI.config.site.langAutoUpdate) {
      const respStrings = await apollo({
        query: `{
          localization {
            strings(code: "${WIKI.config.site.lang}") {
              key
              value
            }
          }
        }`
      })
      const strings = _.get(respStrings, 'data.localization.strings', [])
      let lcObj = {}
      _.forEach(strings, row => {
        if (_.includes(row.key, '::')) { return }
        _.set(lcObj, row.key.replace(':', '.'), row.value)
      })

      WIKI.db.Locale.upsert({
        code: WIKI.config.site.lang,
        strings: lcObj,
        isRTL: currentLocale.isRTL,
        name: currentLocale.name,
        nativeName: currentLocale.nativeName
      })
    }

    WIKI.logger.info('Syncing locales with Graph endpoint: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Syncing locales with Graph endpoint: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
