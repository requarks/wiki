const _ = require('lodash')
const Promise = require('bluebird')
const getos = Promise.promisify(require('getos'))
const os = require('os')
const filesize = require('filesize')
const path = require('path')

/* global WIKI */

const dbTypes = {
  mysql: 'MySQL / MariaDB',
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
    async info() { return {} }
  },
  SystemMutation: { },
  SystemInfo: {
    configFile() {
      return path.join(process.cwd(), 'config.yml')
    },
    currentVersion() {
      return WIKI.version
    },
    dbType() {
      return _.get(dbTypes, WIKI.config.db.type, 'Unknown DB')
    },
    dbVersion() {
      return _.get(WIKI.models, 'knex.client.version', 'Unknown version')
    },
    dbHost() {
      return WIKI.config.db.host
    },
    latestVersion() {
      return '2.0.0' // TODO
    },
    latestVersionReleaseDate() {
      return new Date() // TODO
    },
    async operatingSystem() {
      let osLabel = `${os.type()} (${os.platform()}) ${os.release()} ${os.arch()}`
      if (os.platform() === 'linux') {
        const osInfo = await getos()
        osLabel = `${os.type()} - ${osInfo.dist} (${osInfo.codename || os.platform()}) ${osInfo.release || os.release()} ${os.arch()}`
      }
      return osLabel
    },
    hostname() {
      return os.hostname()
    },
    cpuCores() {
      return os.cpus().length
    },
    ramTotal() {
      return filesize(os.totalmem())
    },
    workingDirectory() {
      return process.cwd()
    },
    nodeVersion() {
      return process.version.substr(1)
    },
    redisVersion() {
      return WIKI.redis.serverInfo.redis_version
    },
    redisUsedRAM() {
      return WIKI.redis.serverInfo.used_memory_human
    },
    redisTotalRAM() {
      return _.get(WIKI.redis.serverInfo, 'total_system_memory_human', 'N/A')
    },
    redisHost() {
      return WIKI.redis.options.host
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
