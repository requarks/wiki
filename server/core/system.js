const _ = require('lodash')
const cfgHelper = require('../helpers/config')
const Promise = require('bluebird')

/* global wiki */

module.exports = {
  /**
   * Upgrade from Wiki.js 1.x - MongoDB database
   *
   * @param {Object} opts Options object
   */
  async upgradeFromMongo (opts) {
    wiki.telemetry.sendEvent('setup', 'upgradeFromMongo')

    wiki.logger.info('Upgrading from MongoDB...')

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
          await wiki.db.User.bulkCreate(_.map(userData, usr => {
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
        } catch (err) {
          reject(err)
        }
        db.close()
      })
    })
  }
}
