const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')
const Sequelize = require('sequelize')

/* global WIKI */

const operatorsAliases = {
  $eq: Sequelize.Op.eq,
  $ne: Sequelize.Op.ne,
  $gte: Sequelize.Op.gte,
  $gt: Sequelize.Op.gt,
  $lte: Sequelize.Op.lte,
  $lt: Sequelize.Op.lt,
  $not: Sequelize.Op.not,
  $in: Sequelize.Op.in,
  $notIn: Sequelize.Op.notIn,
  $is: Sequelize.Op.is,
  $like: Sequelize.Op.like,
  $notLike: Sequelize.Op.notLike,
  $iLike: Sequelize.Op.iLike,
  $notILike: Sequelize.Op.notILike,
  $regexp: Sequelize.Op.regexp,
  $notRegexp: Sequelize.Op.notRegexp,
  $iRegexp: Sequelize.Op.iRegexp,
  $notIRegexp: Sequelize.Op.notIRegexp,
  $between: Sequelize.Op.between,
  $notBetween: Sequelize.Op.notBetween,
  $overlap: Sequelize.Op.overlap,
  $contains: Sequelize.Op.contains,
  $contained: Sequelize.Op.contained,
  $adjacent: Sequelize.Op.adjacent,
  $strictLeft: Sequelize.Op.strictLeft,
  $strictRight: Sequelize.Op.strictRight,
  $noExtendRight: Sequelize.Op.noExtendRight,
  $noExtendLeft: Sequelize.Op.noExtendLeft,
  $and: Sequelize.Op.and,
  $or: Sequelize.Op.or,
  $any: Sequelize.Op.any,
  $all: Sequelize.Op.all,
  $values: Sequelize.Op.values,
  $col: Sequelize.Op.col
}

/**
 * PostgreSQL DB module
 */
module.exports = {
  Sequelize,
  Op: Sequelize.Op,

  /**
   * Initialize DB
   *
   * @return     {Object}  DB instance
   */
  init() {
    let self = this
    let dbModelsPath = path.join(WIKI.SERVERPATH, 'models')

    // Define Sequelize instance

    this.inst = new this.Sequelize(WIKI.config.db.db, WIKI.config.db.user, WIKI.config.db.pass, {
      host: WIKI.config.db.host,
      port: WIKI.config.db.port,
      dialect: WIKI.config.db.type,
      storage: WIKI.config.db.storage,
      pool: {
        max: 10,
        min: 0,
        idle: 10000
      },
      logging: log => { WIKI.logger.log('debug', log) },
      operatorsAliases
    })

    // Attempt to connect and authenticate to DB

    this.inst.authenticate().then(() => {
      WIKI.logger.info(`Database (${WIKI.config.db.type}) connection: [ OK ]`)
    }).catch(err => {
      WIKI.logger.error(`Failed to connect to ${WIKI.config.db.type} instance.`)
      WIKI.logger.error(err)
      process.exit(1)
    })

    // Load DB Models

    fs
      .readdirSync(dbModelsPath)
      .filter(file => {
        return (file.indexOf('.') !== 0 && file.indexOf('_') !== 0)
      })
      .forEach(file => {
        let modelName = _.upperFirst(_.camelCase(_.split(file, '.')[0]))
        self[modelName] = self.inst.import(path.join(dbModelsPath, file))
      })

    // Associate DB Models

    require(path.join(dbModelsPath, '_relations.js'))(self)

    // Set init tasks

    let initTasks = {
      // -> Sync DB Schemas
      syncSchemas() {
        return self.inst.sync({
          force: false,
          logging: log => { WIKI.logger.log('debug', log) }
        })
      },
      // -> Set Connection App Name
      setAppName() {
        switch (WIKI.config.db.type) {
          case 'postgres':
            return self.inst.query(`set application_name = 'WIKI.js'`, { raw: true })
        }
      }
    }

    let initTasksQueue = (WIKI.IS_MASTER) ? [
      initTasks.syncSchemas,
      initTasks.setAppName
    ] : [
      initTasks.setAppName
    ]

    // Perform init tasks

    this.onReady = Promise.each(initTasksQueue, t => t()).return(true)

    return this
  }
}
