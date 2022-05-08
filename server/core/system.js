const _ = require('lodash')
const cfgHelper = require('../helpers/config')
const Promise = require('bluebird')
const fs = require('fs-extra')
const path = require('path')

/* global WIKI */

module.exports = {
  updates: {
    channel: 'BETA',
    version: WIKI.version,
    releaseDate: WIKI.releaseDate,
    minimumVersionRequired: '2.0.0-beta.0',
    minimumNodeRequired: '10.12.0'
  },
  exportStatus: {
    status: 'notrunning',
    progress: 0,
    message: '',
    updatedAt: null
  },
  init() {
    // Clear content cache
    fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache'))

    return this
  },
  /**
   * Upgrade from WIKI.js 1.x - MongoDB database
   *
   * @param {Object} opts Options object
   */
  async upgradeFromMongo (opts) {
    WIKI.logger.info('Upgrading from MongoDB...')

    let mongo = require('mongodb').MongoClient
    let parsedMongoConStr = cfgHelper.parseConfigValue(opts.mongoCnStr)

    return new Promise((resolve, reject) => {
      // Connect to MongoDB

      mongo.connect(parsedMongoConStr, {
        autoReconnect: false,
        reconnectTries: 2,
        reconnectInterval: 1000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 5000
      }, async (err, db) => {
        try {
          if (err !== null) { throw err }

          let users = db.collection('users')

          // Check if users table is populated
          let userCount = await users.count()
          if (userCount < 2) {
            throw new Error('MongoDB Upgrade: Users table is empty!')
          }

          // Import all users
          let userData = await users.find({
            email: {
              $not: 'guest'
            }
          }).toArray()
          await WIKI.models.User.bulkCreate(_.map(userData, usr => {
            return {
              email: usr.email,
              name: usr.name || 'Imported User',
              password: usr.password || '',
              provider: usr.provider || 'local',
              providerId: usr.providerId || '',
              role: 'user',
              createdAt: usr.createdAt
            }
          }))

          resolve(true)
        } catch (errc) {
          reject(errc)
        }
        db.close()
      })
    })
  },
  /**
   * Export Wiki to Disk
   */
  async export (opts) {
    this.exportStatus.status = 'running'
    this.exportStatus.progress = 0
    this.exportStatus.message = ''
    this.exportStatus.startedAt = new Date()

    WIKI.logger.info(`Export started to path ${opts.path}`)
    WIKI.logger.info(`Entities to export: ${opts.entities.join(', ')}`)

    try {
      for (const entity of opts.entities) {
        switch (entity) {
          case 'groups': {
            WIKI.logger.info('Exporting groups...')
            const outputPath = path.join(opts.path, 'groups.json')
            const groups = await WIKI.models.groups.query()
            await fs.outputJSON(outputPath, groups, { spaces: 2 })
            WIKI.logger.info('Export: groups.json created successfully.')
            break
          }
          case 'navigation': {
            WIKI.logger.info('Exporting navigation...')
            const outputPath = path.join(opts.path, 'navigation.json')
            const navigationRaw = await WIKI.models.navigation.query()
            const navigation = navigationRaw.reduce((obj, cur) => {
              obj[cur.key] = cur.config
              return obj
            }, {})
            await fs.outputJSON(outputPath, navigation, { spaces: 2 })
            WIKI.logger.info('Export: navigation.json created successfully.')
            break
          }
          case 'users': {
            WIKI.logger.info('Exporting users...')
            const outputPath = path.join(opts.path, 'users.json')
            const users = await WIKI.models.users.query().withGraphJoined({
              groups: true,
              provider: true
            }).modifyGraph('groups', builder => {
              builder.select('groups.id', 'groups.name')
            }).modifyGraph('provider', builder => {
              builder.select('authentication.key', 'authentication.strategyKey', 'authentication.displayName')
            })
            await fs.outputJSON(outputPath, users, { spaces: 2 })
            WIKI.logger.info('Export: users.json created successfully.')
            break
          }
        }
      }
      this.exportStatus.status = 'success'
      this.exportStatus.progress = 100
    } catch (err) {
      this.exportStatus.status = 'error'
      this.exportStatus.message = err.message
    }
  }
}
