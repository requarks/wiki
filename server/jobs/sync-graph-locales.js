require('../core/worker')
const _ = require('lodash')
const { createApolloFetch } = require('apollo-fetch')

/* global WIKI */

WIKI.redis = require('../core/redis').init()
const apollo = createApolloFetch({
  uri: 'https://graph.requarks.io'
})

module.exports = async (job) => {
  WIKI.logger.info('Syncing locales with Graph endpoint...')

  try {
    const resp = await apollo({
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
    const locales = _.sortBy(_.get(resp, 'data.localization.locales', []), 'name').map(lc => ({...lc, isInstalled: (lc.code === 'en')}))
    WIKI.redis.set('locales', JSON.stringify(locales))

    WIKI.logger.info('Syncing locales with Graph endpoint: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Syncing locales with Graph endpoint: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
