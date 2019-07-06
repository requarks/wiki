const _ = require('lodash')
const Promise = require('bluebird')
const getos = Promise.promisify(require('getos'))
const os = require('os')
const filesize = require('filesize')
const path = require('path')
const fs = require('fs-extra')
const moment = require('moment')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

const dbTypes = {
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  postgres: 'PostgreSQL',
  sqlite: 'SQLite',
  mssql: 'MS SQL Server'
}

module.exports = {
  Query: {
    async system() { return {} }
  },
  Mutation: {
    async system() { return {} }
  },
  SystemQuery: {
    flags() {
      return _.transform(WIKI.config.flags, (result, value, key) => {
        result.push({ key, value })
      }, [])
    },
    async info() { return {} }
  },
  SystemMutation: {
    async updateFlags(obj, args, context) {
      WIKI.config.flags = _.transform(args.flags, (result, row) => {
        _.set(result, row.key, row.value)
      }, {})
      await WIKI.configSvc.applyFlags()
      await WIKI.configSvc.saveToDb(['flags'])
      return {
        responseResult: graphHelper.generateSuccess('System Flags applied successfully')
      }
    },
    async resetTelemetryClientId(obj, args, context) {
      try {
        WIKI.telemetry.generateClientId()
        await WIKI.configSvc.saveToDb(['telemetry'])
        return {
          responseResult: graphHelper.generateSuccess('Telemetry state updated successfully')
        }
      } catch(err) {
        return graphHelper.generateError(err)
      }
    },
    async setTelemetry(obj, args, context) {
      try {
        _.set(WIKI.config, 'telemetry.isEnabled', args.enabled)
        WIKI.telemetry.enabled = args.enabled
        await WIKI.configSvc.saveToDb(['telemetry'])
        return {
          responseResult: graphHelper.generateSuccess('Telemetry Client ID has been reset successfully')
        }
      } catch(err) {
        return graphHelper.generateError(err)
      }
    }
  },
  SystemInfo: {
    configFile() {
      return path.join(process.cwd(), 'config.yml')
    },
    cpuCores() {
      return os.cpus().length
    },
    currentVersion() {
      return WIKI.version
    },
    dbType() {
      return _.get(dbTypes, WIKI.config.db.type, 'Unknown DB')
    },
    async dbVersion() {
      let version = 'Unknown Version'
      switch (WIKI.config.db.type) {
        case 'mariadb':
        case 'mysql':
          const resultMYSQL = await WIKI.models.knex.raw('SELECT VERSION() as version;')
          version = _.get(resultMYSQL, '[0][0].version', 'Unknown Version')
          break
        case 'mssql':
          const resultMSSQL = await WIKI.models.knex.raw('SELECT @@VERSION as version;')
          version = _.get(resultMSSQL, '[0].version', 'Unknown Version')
          break
        case 'postgres':
          version = _.get(WIKI.models, 'knex.client.version', 'Unknown Version')
          break
        case 'sqlite':
          version = _.get(WIKI.models, 'knex.client.driver.VERSION', 'Unknown Version')
          break
      }
      return version
    },
    dbHost() {
      if (WIKI.config.db.type === 'sqlite') {
        return WIKI.config.db.storage
      } else {
        return WIKI.config.db.host
      }
    },
    hostname() {
      return os.hostname()
    },
    latestVersion() {
      return WIKI.system.updates.version
    },
    latestVersionReleaseDate() {
      return moment.utc(WIKI.system.updates.releaseDate)
    },
    nodeVersion() {
      return process.version.substr(1)
    },
    async operatingSystem() {
      let osLabel = `${os.type()} (${os.platform()}) ${os.release()} ${os.arch()}`
      if (os.platform() === 'linux') {
        const osInfo = await getos()
        osLabel = `${os.type()} - ${osInfo.dist} (${osInfo.codename || os.platform()}) ${osInfo.release || os.release()} ${os.arch()}`
      }
      return osLabel
    },
    async platform () {
      const isDockerized = await fs.pathExists('/.dockerenv')
      if (isDockerized) {
        return 'docker'
      }
      return os.platform()
    },
    ramTotal() {
      return filesize(os.totalmem())
    },
    telemetry() {
      return WIKI.telemetry.enabled
    },
    telemetryClientId() {
      return WIKI.config.telemetry.clientId
    },
    workingDirectory() {
      return process.cwd()
    },
    async groupsTotal() {
      const total = await WIKI.models.groups.query().count('* as total').first().pluck('total')
      return _.toSafeInteger(total)
    },
    async pagesTotal() {
      const total = await WIKI.models.pages.query().count('* as total').first().pluck('total')
      return _.toSafeInteger(total)
    },
    async usersTotal() {
      const total = await WIKI.models.users.query().count('* as total').first().pluck('total')
      return _.toSafeInteger(total)
    }
  }
}
