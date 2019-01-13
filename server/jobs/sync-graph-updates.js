require('../core/worker')
const _ = require('lodash')
const { createApolloFetch } = require('apollo-fetch')

/* global WIKI */

WIKI.redis = require('../core/redis').init()
WIKI.models = require('../core/db').init()

module.exports = async (job) => {
  WIKI.logger.info(`Fetching latest updates from Graph endpoint...`)

  try {
    await WIKI.configSvc.loadFromDb()
    const apollo = createApolloFetch({
      uri: WIKI.config.graphEndpoint
    })

    const resp = await apollo({
      query: `query ($channel: ReleaseChannel!, $version: String!) {
        releases {
          checkForUpdates(channel: $channel, version: $version) {
            channel
            version
            releaseDate
            minimumVersionRequired
            minimumNodeRequired
          }
        }
      }`,
      variables: {
        channel: 'BETA', // TODO
        version: WIKI.version
      }
    })
    const info = _.get(resp, 'data.releases.checkForUpdates', {})

    await WIKI.redis.publish('updates', JSON.stringify(info))

    WIKI.logger.info(`Fetching latest updates from Graph endpoint: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Fetching latest updates from Graph endpoint: [ FAILED ]`)
    WIKI.logger.error(err.message)
  }
}
