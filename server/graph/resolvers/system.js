const _ = require('lodash')
const os = require('os')
const filesize = require('filesize')

/* global WIKI */

module.exports = {
  Query: {
    async system() { return {} }
  },
  Mutation: {
    async system() { return {} }
  },
  SystemQuery: {
    async info(obj, args, context, info) {
      return {
        currentVersion: WIKI.version,
        latestVersion: WIKI.version, // TODO
        latestVersionReleaseDate: new Date(), // TODO
        operatingSystem: `${os.type()} (${os.platform()}) ${os.release()} ${os.arch()}`,
        hostname: os.hostname(),
        cpuCores: os.cpus().length,
        ramTotal: filesize(os.totalmem()),
        workingDirectory: process.cwd(),
        nodeVersion: process.version.substr(1),
        redisVersion: WIKI.redis.serverInfo.redis_version,
        redisUsedRAM: WIKI.redis.serverInfo.used_memory_human,
        redisTotalRAM: _.get(WIKI.redis.serverInfo, 'total_system_memory_human', 'N/A'),
        redisHost: WIKI.redis.options.host,
        postgreVersion: WIKI.db.inst.options.databaseVersion,
        postgreHost: WIKI.db.inst.options.host
      }
    }
  },
  SystemMutation: { }
}
