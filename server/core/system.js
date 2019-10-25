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
  }
}
