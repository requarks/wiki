const _ = require('lodash')
const Promise = require('bluebird')
const getos = Promise.promisify(require('getos'))
const os = require('os')
const filesize = require('filesize')
const path = require('path')
const fs = require('fs-extra')
const moment = require('moment')
const graphHelper = require('../../helpers/graph')
const request = require('request-promise')
const crypto = require('crypto')
const nanoid = require('nanoid/non-secure/generate')

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
    async system () { return {} }
  },
  Mutation: {
    async system () { return {} }
  },
  SystemQuery: {
    flags () {
      return _.transform(WIKI.config.flags, (result, value, key) => {
        result.push({ key, value })
      }, [])
    },
    async info() { return {} }
  },
  SystemMutation: {
    async updateFlags (obj, args, context) {
      WIKI.config.flags = _.transform(args.flags, (result, row) => {
        _.set(result, row.key, row.value)
      }, {})
      await WIKI.configSvc.applyFlags()
      await WIKI.configSvc.saveToDb(['flags'])
      return {
        responseResult: graphHelper.generateSuccess('System Flags applied successfully')
      }
    },
    async resetTelemetryClientId (obj, args, context) {
      try {
        WIKI.telemetry.generateClientId()
        await WIKI.configSvc.saveToDb(['telemetry'])
        return {
          responseResult: graphHelper.generateSuccess('Telemetry state updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async setTelemetry (obj, args, context) {
      try {
        _.set(WIKI.config, 'telemetry.isEnabled', args.enabled)
        WIKI.telemetry.enabled = args.enabled
        await WIKI.configSvc.saveToDb(['telemetry'])
        return {
          responseResult: graphHelper.generateSuccess('Telemetry Client ID has been reset successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async performUpgrade (obj, args, context) {
      try {
        if (process.env.UPGRADE_COMPANION) {
          await request({
            method: 'POST',
            uri: 'http://wiki-update-companion/upgrade'
          })
          return {
            responseResult: graphHelper.generateSuccess('Upgrade has started.')
          }
        } else {
          throw new Error('You must run the wiki-update-companion container and pass the UPGRADE_COMPANION env var in order to use this feature.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Import Users from a v1 installation
     */
    async importUsersFromV1(obj, args, context) {
      try {
        const MongoClient = require('mongodb').MongoClient
        if (args.mongoDbConnString && args.mongoDbConnString.length > 10) {
          // -> Connect to DB

          const client = await MongoClient.connect(args.mongoDbConnString, {
            appname: `Wiki.js ${WIKI.version} Migration Tool`
          })
          const dbUsers = client.db().collection('users')
          const userCursor = dbUsers.find({ email: { '$ne': 'guest' } })

          const curDateISO = new Date().toISOString()

          let failed = []
          let usersCount = 0
          let groupsCount = 0
          let assignableGroups = []
          let reuseGroups = []

          // -> Create SINGLE group

          if (args.groupMode === `SINGLE`) {
            const singleGroup = await WIKI.models.groups.query().insert({
              name: `Import_${curDateISO}`,
              permissions: JSON.stringify(WIKI.data.groups.defaultPermissions),
              pageRules: JSON.stringify(WIKI.data.groups.defaultPageRules)
            })
            groupsCount++
            assignableGroups.push(singleGroup.id)
          }

          // -> Iterate all users

          while (await userCursor.hasNext()) {
            const usr = await userCursor.next()

            let usrGroup = []
            if (args.groupMode === `MULTI`) {
              // -> Check if global admin

              if (_.some(usr.rights, ['role', 'admin'])) {
                usrGroup.push(1)
              } else {
                // -> Check if identical group already exists

                const currentRights = _.sortBy(_.map(usr.rights, r => _.pick(r, ['role', 'path', 'exact', 'deny'])), ['role', 'path', 'exact', 'deny'])
                const ruleSetId = crypto.createHash('sha1').update(JSON.stringify(currentRights)).digest('base64')
                const existingGroup = _.find(reuseGroups, ['hash', ruleSetId])
                if (existingGroup) {
                  usrGroup.push(existingGroup.groupId)
                } else {
                  // -> Build new group

                  const pageRules = _.map(usr.rights, r => {
                    let roles = ['read:pages', 'read:assets', 'read:comments', 'write:comments']
                    if (r.role === `write`) {
                      roles = _.concat(roles, ['write:pages', 'manage:pages', 'read:source', 'read:history', 'write:assets', 'manage:assets'])
                    }
                    return {
                      id: nanoid('1234567890abcdef', 10),
                      roles: roles,
                      match: r.exact ? 'EXACT' : 'START',
                      deny: r.deny,
                      path: (r.path.indexOf('/') === 0) ? r.path.substring(1) : r.path,
                      locales: []
                    }
                  })

                  const perms = _.chain(pageRules).reject('deny').map('roles').union().flatten().value()

                  // -> Create new group

                  const newGroup = await WIKI.models.groups.query().insert({
                    name: `Import_${curDateISO}_${groupsCount + 1}`,
                    permissions: JSON.stringify(perms),
                    pageRules: JSON.stringify(pageRules)
                  })
                  reuseGroups.push({
                    groupId: newGroup.id,
                    hash: ruleSetId
                  })
                  groupsCount++
                  usrGroup.push(newGroup.id)
                }
              }
            }

            // -> Create User

            try {
              await WIKI.models.users.createNewUser({
                providerKey: usr.provider,
                email: usr.email,
                name: usr.name,
                passwordRaw: usr.password,
                groups: (usrGroup.length > 0) ? usrGroup : assignableGroups,
                mustChangePassword: false,
                sendWelcomeEmail: false
              })
              usersCount++
            } catch (err) {
              failed.push({
                provider: usr.provider,
                email: usr.email,
                error: err.message
              })
              WIKI.logger.warn(`${usr.email}: ${err}`)
            }
          }

          // -> Reload group permissions

          if (args.groupMode !== `NONE`) {
            await WIKI.auth.reloadGroups()
          }

          client.close()
          return {
            responseResult: graphHelper.generateSuccess('Import completed.'),
            usersCount: usersCount,
            groupsCount: groupsCount,
            failed: failed
          }
        } else {
          throw new Error('MongoDB Connection String is missing or invalid.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
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
    dbType () {
      return _.get(dbTypes, WIKI.config.db.type, 'Unknown DB')
    },
    async dbVersion () {
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
    dbHost () {
      if (WIKI.config.db.type === 'sqlite') {
        return WIKI.config.db.storage
      } else {
        return WIKI.config.db.host
      }
    },
    hostname () {
      return os.hostname()
    },
    latestVersion () {
      return WIKI.system.updates.version
    },
    latestVersionReleaseDate () {
      return moment.utc(WIKI.system.updates.releaseDate)
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
      const total = await WIKI.models.groups.query().count('* as total').first().pluck('total')
      return _.toSafeInteger(total)
    },
    async pagesTotal () {
      const total = await WIKI.models.pages.query().count('* as total').first().pluck('total')
      return _.toSafeInteger(total)
    },
    async usersTotal () {
      const total = await WIKI.models.users.query().count('* as total').first().pluck('total')
      return _.toSafeInteger(total)
    }
  }
}
