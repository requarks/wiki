const _ = require('lodash')
const { createApolloFetch } = require('apollo-fetch')

/* global WIKI */

module.exports = async () => {
  WIKI.logger.info(`Fetching latest updates from Graph endpoint...`)

  try {
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
        channel: WIKI.config.channel,
        version: WIKI.version
      }
    })
    const info = _.get(resp, 'data.releases.checkForUpdates', false)
    if (info) {
      WIKI.system.updates = info
    }

    WIKI.logger.info(`Fetching latest updates from Graph endpoint: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Fetching latest updates from Graph endpoint: [ FAILED ]`)
    WIKI.logger.error(err.message)
  }
}
