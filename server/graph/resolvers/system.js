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
  sqlite: 'SQLite'
}

module.exports = {
  Query: {
    async system() { return {} }
  },
  Mutation: {
    async system() { return {} }
  },
  SystemQuery: {
    async info(obj, args, context, info) {
      let osLabel = `${os.type()} (${os.platform()}) ${os.release()} ${os.arch()}`
      if (os.platform() === 'linux') {
        const osInfo = await getos()
        osLabel = `${os.type()} - ${osInfo.dist} (${osInfo.codename || os.platform()}) ${osInfo.release || os.release()} ${os.arch()}`
      }

      return {
        configFile: path.join(process.cwd(), 'config.yml'),
        currentVersion: WIKI.version,
        dbType: _.get(dbTypes, WIKI.config.db.type, 'Unknown DB'),
        dbVersion: WIKI.db.inst.options.databaseVersion,
        dbHost: WIKI.db.inst.options.host,
        latestVersion: WIKI.version, // TODO
        latestVersionReleaseDate: new Date(), // TODO
        operatingSystem: osLabel,
        hostname: os.hostname(),
        cpuCores: os.cpus().length,
        ramTotal: filesize(os.totalmem()),
        workingDirectory: process.cwd(),
        nodeVersion: process.version.substr(1),
        redisVersion: WIKI.redis.serverInfo.redis_version,
        redisUsedRAM: WIKI.redis.serverInfo.used_memory_human,
        redisTotalRAM: _.get(WIKI.redis.serverInfo, 'total_system_memory_human', 'N/A'),
        redisHost: WIKI.redis.options.host
      }
    }
  },
  SystemMutation: { }
}
