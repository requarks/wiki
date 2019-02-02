const _ = require('lodash')
const autoload = require('auto-load')
const path = require('path')
const Promise = require('bluebird')
const Knex = require('knex')
const Objection = require('objection')

const migrationSource = require('../db/migrator-source')

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
    let dbConfig = (!_.isEmpty(process.env.WIKI_DB_CONNSTR)) ? process.env.WIKI_DB_CONNSTR : {
      host: WIKI.config.db.host,
      user: WIKI.config.db.user,
      password: WIKI.config.db.pass,
      database: WIKI.config.db.db,
      port: WIKI.config.db.port
    }

    switch (WIKI.config.db.type) {
      case 'postgres':
        dbClient = 'pg'
        break
      case 'mariadb':
      case 'mysql':
        dbClient = 'mysql2'

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
    let initTasks = {
      // -> Migrate DB Schemas
      async syncSchemas() {
        return self.knex.migrate.latest({
          tableName: 'migrations',
          migrationSource
        })
      }
    }

    let initTasksQueue = (WIKI.IS_MASTER) ? [
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
