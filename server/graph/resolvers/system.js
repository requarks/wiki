const _ = require('lodash')
const util = require('node:util')
const getos = util.promisify(require('getos'))
const os = require('node:os')
const filesize = require('filesize')
const path = require('path')
const fs = require('fs-extra')
const { DateTime } = require('luxon')
const graphHelper = require('../../helpers/graph')
const cronParser = require('cron-parser')

module.exports = {
  Query: {
    systemFlags () {
      return _.transform(WIKI.config.flags, (result, value, key) => {
        result.push({ key, value })
      }, [])
    },
    async systemInfo () { return {} },
    async systemExtensions () {
      const exts = Object.values(WIKI.extensions.ext).map(ext => _.pick(ext, ['key', 'title', 'description', 'isInstalled', 'isInstallable']))
      for (const ext of exts) {
        ext.isCompatible = await WIKI.extensions.ext[ext.key].isCompatible()
      }
      return exts
    },
    systemSecurity () {
      return WIKI.config.security
    },
    async systemJobs (obj, args) {
      switch (args.type) {
        case 'ACTIVE': {
          // const result = await WIKI.scheduler.boss.fetch('*', 25, { includeMeta: true })
          return []
        }
        case 'COMPLETED': {
          const result = await WIKI.scheduler.boss.fetchCompleted('*', 25, { includeMeta: true })
          console.info(result)
          return result ?? []
        }
        default: {
          WIKI.logger.warn('Invalid Job Type requested.')
          return []
        }
      }
    },
    async systemScheduledJobs (obj, args) {
      const jobs = await WIKI.scheduler.boss.getSchedules()
      return jobs.map(job => ({
        id: job.name,
        name: job.name,
        cron: job.cron,
        timezone: job.timezone,
        nextExecution: cronParser.parseExpression(job.cron, { tz: job.timezone }).next(),
        createdAt: job.created_on,
        updatedAt: job.updated_on
      }))
    }
  },
  Mutation: {
    async disconnectWS (obj, args, context) {
      WIKI.servers.ws.disconnectSockets(true)
      WIKI.logger.info('All active websocket connections have been terminated.')
      return {
        operation: graphHelper.generateSuccess('All websocket connections closed successfully.')
      }
    },
    async installExtension (obj, args, context) {
      try {
        await WIKI.extensions.ext[args.key].install()
        // TODO: broadcast ext install
        return {
          operation: graphHelper.generateSuccess('Extension installed successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateSystemFlags (obj, args, context) {
      WIKI.config.flags = _.transform(args.flags, (result, row) => {
        _.set(result, row.key, row.value)
      }, {})
      await WIKI.configSvc.applyFlags()
      await WIKI.configSvc.saveToDb(['flags'])
      return {
        operation: graphHelper.generateSuccess('System Flags applied successfully')
      }
    },
    async updateSystemSecurity (obj, args, context) {
      WIKI.config.security = _.defaultsDeep(_.omit(args, ['__typename']), WIKI.config.security)
      // TODO: broadcast config update
      await WIKI.configSvc.saveToDb(['security'])
      return {
        status: graphHelper.generateSuccess('System Security configuration applied successfully')
      }
    }
  },
  SystemInfo: {
    configFile () {
      return path.join(process.cwd(), 'config.yml')
    },
    cpuCores () {
      return os.cpus().length
    },
    currentVersion () {
      return WIKI.version
    },
    dbHost () {
      return WIKI.config.db.host
    },
    dbVersion () {
      return _.get(WIKI.db, 'knex.client.version', 'Unknown Version')
    },
    hostname () {
      return os.hostname()
    },
    httpPort () {
      return WIKI.servers.servers.http ? _.get(WIKI.servers.servers.http.address(), 'port', 0) : 0
    },
    httpRedirection () {
      return _.get(WIKI.config, 'server.sslRedir', false)
    },
    httpsPort () {
      return WIKI.servers.servers.https ? _.get(WIKI.servers.servers.https.address(), 'port', 0) : 0
    },
    latestVersion () {
      return WIKI.system.updates.version
    },
    latestVersionReleaseDate () {
      return DateTime.fromISO(WIKI.system.updates.releaseDate).toJSDate()
    },
    mailConfigured () {
      return WIKI.config?.mail?.host?.length > 2
    },
    nodeVersion () {
      return process.version.substr(1)
    },
    async operatingSystem () {
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
    ramTotal () {
      return filesize(os.totalmem())
    },
    sslDomain () {
      return WIKI.config.ssl.enabled && WIKI.config.ssl.provider === 'letsencrypt' ? WIKI.config.ssl.domain : null
    },
    sslExpirationDate () {
      return WIKI.config.ssl.enabled && WIKI.config.ssl.provider === 'letsencrypt' ? _.get(WIKI.config.letsencrypt, 'payload.expires', null) : null
    },
    sslProvider () {
      return WIKI.config.ssl.enabled ? WIKI.config.ssl.provider : null
    },
    sslStatus () {
      return 'OK'
    },
    sslSubscriberEmail () {
      return WIKI.config.ssl.enabled && WIKI.config.ssl.provider === 'letsencrypt' ? WIKI.config.ssl.subscriberEmail : null
    },
    telemetry () {
      return WIKI.telemetry.enabled
    },
    telemetryClientId () {
      return WIKI.config.telemetry.clientId
    },
    async upgradeCapable () {
      return !_.isNil(process.env.UPGRADE_COMPANION)
    },
    workingDirectory () {
      return process.cwd()
    },
    async groupsTotal () {
      const total = await WIKI.db.groups.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    },
    async pagesTotal () {
      const total = await WIKI.db.pages.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    },
    async usersTotal () {
      const total = await WIKI.db.users.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    },
    async tagsTotal () {
      const total = await WIKI.db.tags.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    }
  }
}
