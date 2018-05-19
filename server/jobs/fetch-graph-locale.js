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
  WIKI.logger.info(`Fetching locale ${job.data.locale} from Graph endpoint...`)

  try {
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
        code: job.data.locale
      }
    })
    const strings = _.get(respStrings, 'data.localization.strings', [])
    let lcObj = {}
    _.forEach(strings, row => {
      if (_.includes(row.key, '::')) { return }
      _.set(lcObj, row.key.replace(':', '.'), row.value)
    })

    const locales = await WIKI.redis.get('locales')
    if (locales) {
      const currentLocale = _.find(JSON.parse(locales), ['code', job.data.locale]) || {}
      await WIKI.db.locales.query().delete().where('code', job.data.locale)
      await WIKI.db.locales.query().insert({
        code: job.data.locale,
        strings: lcObj,
        isRTL: currentLocale.isRTL,
        name: currentLocale.name,
        nativeName: currentLocale.nativeName
      })
    } else {
      throw new Error('Failed to fetch cached locales list! Restart server to resolve this issue.')
    }

    WIKI.logger.info(`Fetching locale ${job.data.locale} from Graph endpoint: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Fetching locale ${job.data.locale} from Graph endpoint: [ FAILED ]`)
    WIKI.logger.error(err.message)
  }
}
