/* global wiki */

const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const Promise = require('bluebird')
const Sequelize = require('sequelize')
const Op = Sequelize.Op

const operatorsAliases = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $not: Op.not,
  $in: Op.in,
  $notIn: Op.notIn,
  $is: Op.is,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $notILike: Op.notILike,
  $regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $overlap: Op.overlap,
  $contains: Op.contains,
  $contained: Op.contained,
  $adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  $strictRight: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  $and: Op.and,
  $or: Op.or,
  $any: Op.any,
  $all: Op.all,
  $values: Op.values,
  $col: Op.col
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
      },
      logging: log => { wiki.logger.log('verbose', log) },
      operatorsAliases
    })

    // Attempt to connect and authenticate to DB

    self.inst.authenticate().then(() => {
      wiki.logger.info('Database (PostgreSQL) connection: OK')
    }).catch(err => {
      wiki.logger.error('Failed to connect to PostgreSQL instance.')
      wiki.logger.error(err)
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
          logging: log => { wiki.logger.log('verbose', log) }
        })
      },
      // -> Set Connection App Name
      setAppName() {
        return self.inst.query(`set application_name = 'Wiki.js'`, { raw: true })
      }
    }

    let initTasksQueue = (wiki.IS_MASTER) ? [
      initTasks.syncSchemas,
      initTasks.setAppName
    ] : [
      initTasks.setAppName
    ]

    // Perform init tasks

    self.onReady = Promise.each(initTasksQueue, t => t()).return(true)

    return self
  }

}
