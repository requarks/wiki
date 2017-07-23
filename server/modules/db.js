'use strict'

/* global wiki */

const fs = require('fs')
const path = require('path')
const _ = require('lodash')

/**
 * PostgreSQL DB module
 */
module.exports = {

  Sequelize: require('sequelize'),

  /**
   * Initialize DB
   *
   * @return     {Object}  DB instance
   */
  init() {
    let self = this

    let dbModelsPath = path.join(wiki.SERVERPATH, 'models')

    // Define Sequelize instance

    self.inst = new self.Sequelize(wiki.config.db.db, wiki.config.db.user, wiki.config.db.pass, {
      host: wiki.config.db.host,
      port: wiki.config.db.port,
      dialect: 'postgres',
      pool: {
        max: 10,
        min: 0,
        idle: 10000
      }
    })

    // Attempt to connect and authenticate to DB

    self.inst.authenticate().then(() => {
      wiki.logger.info('Connected to PostgreSQL database.')
    }).catch(err => {
      wiki.logger.error('Failed to connect to MongoDB instance.')
      return err
    })

    // Load DB Models

    fs
      .readdirSync(dbModelsPath)
      .filter(function (file) {
        return (file.indexOf('.') !== 0 && file.indexOf('_') !== 0)
      })
      .forEach(function (file) {
        let modelName = _.upperFirst(_.camelCase(_.split(file, '.')[0]))
        self[modelName] = self.inst.import(path.join(dbModelsPath, file))
      })

    // Associate DB Models

    require(path.join(dbModelsPath, '_relations.js'))(self)

    // Sync DB

    self.onReady = self.inst.sync({
      force: false,
      logging: wiki.logger.verbose
    })

    return self
  }

}
