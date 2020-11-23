const _ = require('lodash')
const { createApolloFetch } = require('apollo-fetch')
const { v4: uuid } = require('uuid')
const os = require('os')
const fs = require('fs-extra')

/* global WIKI */

module.exports = {
  enabled: false,
  init() {
    WIKI.telemetry = this

    if (_.get(WIKI.config, 'telemetry.isEnabled', false) === true && WIKI.config.offline !== true) {
      this.enabled = true
      this.sendInstanceEvent('STARTUP')
    }
  },
  sendError(err) {
    // TODO
  },
  sendEvent(eventCategory, eventAction, eventLabel) {
    // TODO
  },
  async sendInstanceEvent(eventType) {
    if (WIKI.devMode || !this.enabled) { return }

    try {
      const apollo = createApolloFetch({
        uri: WIKI.config.graphEndpoint
      })

      // Platform detection
      let platform = 'LINUX'
      let isDockerized = false
      let osname = `${os.type()} ${os.release()}`
      switch (os.platform()) {
        case 'win32':
          platform = 'WINDOWS'
          break
        case 'darwin':
          platform = 'MACOS'
          break
        default:
          platform = 'LINUX'
          isDockerized = await fs.pathExists('/.dockerenv')
          if (isDockerized) {
            osname = 'Docker'
          }
          break
      }

      // DB Version detection
      let dbVersion = 'Unknown'
      switch (WIKI.config.db.type) {
        case 'mariadb':
        case 'mysql':
          const resultMYSQL = await WIKI.models.knex.raw('SELECT VERSION() as version;')
          dbVersion = _.get(resultMYSQL, '[0][0].version', 'Unknown')
          break
        case 'mssql':
          const resultMSSQL = await WIKI.models.knex.raw('SELECT @@VERSION as version;')
          dbVersion = _.get(resultMSSQL, '[0].version', 'Unknown')
          break
        case 'postgres':
          dbVersion = _.get(WIKI.models, 'knex.client.version', 'Unknown')
          break
        case 'sqlite':
          dbVersion = _.get(WIKI.models, 'knex.client.driver.VERSION', 'Unknown')
          break
      }

      let arch = os.arch().toUpperCase()
      if (['ARM', 'ARM64', 'X32', 'X64'].indexOf(arch) < 0) {
        arch = 'OTHER'
      }

      // Send Event
      const respStrings = await apollo({
        query: `mutation (
          $version: String!
          $platform: TelemetryPlatform!
          $os: String!
          $architecture: TelemetryArchitecture!
          $dbType: TelemetryDBType!
          $dbVersion: String!
          $nodeVersion: String!
          $cpuCores: Int!
          $ramMBytes: Int!,
          $clientId: String!,
          $event: TelemetryInstanceEvent!
          ) {
          telemetry {
            instance(
              version: $version
              platform: $platform
              os: $os
              architecture: $architecture
              dbType: $dbType
              dbVersion: $dbVersion
              nodeVersion: $nodeVersion
              cpuCores: $cpuCores
              ramMBytes: $ramMBytes
              clientId: $clientId
              event: $event
            ) {
              responseResult {
                succeeded
                errorCode
                slug
                message
              }
            }
          }
        }`,
        variables: {
          version: WIKI.version,
          platform,
          os: osname,
          architecture: arch,
          dbType: WIKI.config.db.type.toUpperCase(),
          dbVersion,
          nodeVersion: process.version.substr(1),
          cpuCores: os.cpus().length,
          ramMBytes: Math.round(os.totalmem() / 1024 / 1024),
          clientId: WIKI.config.telemetry.clientId,
          event: eventType
        }
      })
      const telemetryResponse = _.get(respStrings, 'data.telemetry.instance.responseResult', { succeeded: false, message: 'Unexpected Error' })
      if (!telemetryResponse.succeeded) {
        WIKI.logger.warn('Failed to send instance telemetry: ' + telemetryResponse.message)
      } else {
        WIKI.logger.info('Telemetry is active: [ OK ]')
      }
    } catch (err) {
      WIKI.logger.warn(err)
    }
  },
  generateClientId() {
    _.set(WIKI.config, 'telemetry.clientId', uuid())
    return WIKI.config.telemetry.clientId
  }
}
