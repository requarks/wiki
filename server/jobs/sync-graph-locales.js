require('../core/worker')
const _ = require('lodash')
const { createApolloFetch } = require('apollo-fetch')

/* global WIKI */

WIKI.redis = require('../core/redis').init()
WIKI.models = require('../core/db').init()

module.exports = async (job) => {
  WIKI.logger.info('Syncing locales with Graph endpoint...')

  try {
    await WIKI.configSvc.loadFromDb()
    const apollo = createApolloFetch({
      uri: WIKI.config.graphEndpoint
    })

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
    const currentLocale = _.find(locales, ['code', WIKI.config.lang.code])

    // -> Download locale strings

    if (WIKI.config.lang.autoUpdate) {
      const respStrings = await apollo({
        query: `query ($code: String!) {
          localization {
            strings(code: $code) {
              key
              value
            }
          }
        }`,
        variables: {
          code: WIKI.config.lang.code
        }
      })
      const strings = _.get(respStrings, 'data.localization.strings', [])
      let lcObj = {}
      _.forEach(strings, row => {
        if (_.includes(row.key, '::')) { return }
        _.set(lcObj, row.key.replace(':', '.'), row.value)
      })

      await WIKI.models.locales.query().update({
        code: WIKI.config.lang.code,
        strings: lcObj,
        isRTL: currentLocale.isRTL,
        name: currentLocale.name,
        nativeName: currentLocale.nativeName
      }).where('code', WIKI.config.lang.code)
    }

    WIKI.logger.info('Syncing locales with Graph endpoint: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Syncing locales with Graph endpoint: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
