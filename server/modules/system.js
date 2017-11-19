/* global wiki */

const Promise = require('bluebird')
// const pm2 = Promise.promisifyAll(require('pm2'))
// const _ = require('lodash')
const cfgHelper = require('../helpers/config')

module.exports = {
  /**
   * Upgrade from Wiki.js 1.x - MongoDB database
   *
   * @param {Object} opts Options object
   */
  async upgradeFromMongo (opts) {
    wiki.telemetry.sendEvent('setup', 'upgradeFromMongo')

    let mongo = require('mongodb').MongoClient
    let parsedMongoConStr = cfgHelper.parseConfigValue(opts.mongoCnStr)

    return new Promise((resolve, reject) => {
      // Connect to MongoDB

      return mongo.connect(parsedMongoConStr, {
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
          if (userCount < 1) {
            throw new Error('Users table is empty or invalid!')
          }

          // Fetch all users
          let userData = await users.find({}).toArray()
          console.info(userData)

          resolve(true)
        } catch (err) {
          reject(err)
          db.close()
        }
      })
    })
  }
}
