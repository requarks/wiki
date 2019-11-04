const _ = require('lodash')
const autoload = require('auto-load')
const path = require('path')
const Promise = require('bluebird')
const Knex = require('knex')
const Objection = require('objection')

const migrationSource = require('../db/migrator-source')
const migrateFromBeta = require('../db/beta')

/* global WIKI */

/**
 * ORM DB module
 */
module.exports = {
  Objection,
  knex: null,
  /**
   * Initialize DB
   *
   * @return     {Object}  DB instance
   */
  init() {
    let self = this

    let dbClient = null
    let dbConfig = (!_.isEmpty(process.env.DATABASE_URL)) ? process.env.DATABASE_URL : {
      host: WIKI.config.db.host,
      user: WIKI.config.db.user,
      password: WIKI.config.db.pass,
      database: WIKI.config.db.db,
      port: WIKI.config.db.port
    }

    const dbUseSSL = (WIKI.config.db.ssl === true || WIKI.config.db.ssl === 'true' || WIKI.config.db.ssl === 1 || WIKI.config.db.ssl === '1')

    switch (WIKI.config.db.type) {
      case 'postgres':
        dbClient = 'pg'

        if (dbUseSSL && _.isPlainObject(dbConfig)) {
          dbConfig.ssl = true
        }
        break
      case 'mariadb':
      case 'mysql':
        dbClient = 'mysql2'

        if (dbUseSSL && _.isPlainObject(dbConfig)) {
          dbConfig.ssl = true
        }

        // Fix mysql boolean handling...
        dbConfig.typeCast = (field, next) => {
          if (field.type === 'TINY' && field.length === 1) {
            let value = field.string()
            return value ? (value === '1') : null
          }
          return next()
        }
        break
      case 'mssql':
        dbClient = 'mssql'

        if (_.isPlainObject(dbConfig)) {
          dbConfig.appName = 'Wiki.js'
          if (dbUseSSL) {
            dbConfig.encrypt = true
          }
        }
        break
      case 'sqlite':
        dbClient = 'sqlite3'
        dbConfig = { filename: WIKI.config.db.storage }
        break
      default:
        WIKI.logger.error('Invalid DB Type')
        process.exit(1)
    }

    this.knex = Knex({
      client: dbClient,
      useNullAsDefault: true,
      asyncStackTraces: WIKI.IS_DEBUG,
      connection: dbConfig,
      pool: {
        ...WIKI.config.pool,
        async afterCreate(conn, done) {
          // -> Set Connection App Name
          switch (WIKI.config.db.type) {
            case 'postgres':
              await conn.query(`set application_name = 'Wiki.js'`)
              done()
              break
            default:
              done()
              break
          }
        }
      },
      debug: WIKI.IS_DEBUG
    })

    Objection.Model.knex(this.knex)

    // Load DB Models

    const models = autoload(path.join(WIKI.SERVERPATH, 'models'))

    // Set init tasks
    let conAttempts = 0
    let initTasks = {
      // -> Attempt initial connection
      async connect () {
        try {
          WIKI.logger.info('Connecting to database...')
          await self.knex.raw('SELECT 1 + 1;')
          WIKI.logger.info('Database Connection Successful [ OK ]')
        } catch (err) {
          if (conAttempts < 10) {
            WIKI.logger.error(`Database Connection Error: ${err.code} ${err.address}:${err.port}`)
            WIKI.logger.warn(`Will retry in 3 seconds... [Attempt ${++conAttempts} of 10]`)
            await new Promise(resolve => setTimeout(resolve, 3000))
            await initTasks.connect()
          } else {
            throw err
          }
        }
      },
      // -> Migrate DB Schemas
      async syncSchemas () {
        return self.knex.migrate.latest({
          tableName: 'migrations',
          migrationSource
        })
      },
      // -> Migrate DB Schemas from beta
      async migrateFromBeta () {
        return migrateFromBeta.migrate(self.knex)
      }
    }

    let initTasksQueue = (WIKI.IS_MASTER) ? [
      initTasks.connect,
      initTasks.migrateFromBeta,
      initTasks.syncSchemas
    ] : [
      () => { return Promise.resolve() }
    ]

    // Perform init tasks

    this.onReady = Promise.each(initTasksQueue, t => t()).return(true)

    return {
      ...this,
      ...models
    }
  }
}
