const _ = require('lodash')
const autoload = require('auto-load')
const path = require('path')
const Promise = require('bluebird')
const Knex = require('knex')
const fs = require('fs')
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
  listener: null,
  /**
   * Initialize DB
   *
   * @return     {Object}  DB instance
   */
  init() {
    let self = this

    // Fetch DB Config

    let dbClient = null
    let dbConfig = (!_.isEmpty(process.env.DATABASE_URL)) ? process.env.DATABASE_URL : {
      host: WIKI.config.db.host.toString(),
      user: WIKI.config.db.user.toString(),
      password: WIKI.config.db.pass.toString(),
      database: WIKI.config.db.db.toString(),
      port: WIKI.config.db.port
    }

    // Handle SSL Options

    let dbUseSSL = (WIKI.config.db.ssl === true || WIKI.config.db.ssl === 'true' || WIKI.config.db.ssl === 1 || WIKI.config.db.ssl === '1')
    let sslOptions = null
    if (dbUseSSL && _.isPlainObject(dbConfig) && _.get(WIKI.config.db, 'sslOptions.auto', null) === false) {
      sslOptions = WIKI.config.db.sslOptions
      sslOptions.rejectUnauthorized = sslOptions.rejectUnauthorized !== false
      if (sslOptions.ca && sslOptions.ca.indexOf('-----') !== 0) {
        sslOptions.ca = fs.readFileSync(path.resolve(WIKI.ROOTPATH, sslOptions.ca))
      }
      if (sslOptions.cert) {
        sslOptions.cert = fs.readFileSync(path.resolve(WIKI.ROOTPATH, sslOptions.cert))
      }
      if (sslOptions.key) {
        sslOptions.key = fs.readFileSync(path.resolve(WIKI.ROOTPATH, sslOptions.key))
      }
      if (sslOptions.pfx) {
        sslOptions.pfx = fs.readFileSync(path.resolve(WIKI.ROOTPATH, sslOptions.pfx))
      }
    } else {
      sslOptions = true
    }

    // Handle inline SSL CA Certificate mode
    if (!_.isEmpty(process.env.DB_SSL_CA)) {
      const chunks = []
      for (let i = 0, charsLength = process.env.DB_SSL_CA.length; i < charsLength; i += 64) {
        chunks.push(process.env.DB_SSL_CA.substring(i, i + 64))
      }

      dbUseSSL = true
      sslOptions = {
        rejectUnauthorized: true,
        ca: '-----BEGIN CERTIFICATE-----\n' + chunks.join('\n') + '\n-----END CERTIFICATE-----\n'
      }
    }

    // Engine-specific config
    switch (WIKI.config.db.type) {
      case 'postgres':
        dbClient = 'pg'

        if (dbUseSSL && _.isPlainObject(dbConfig)) {
          dbConfig.ssl = (sslOptions === true) ? { rejectUnauthorized: true } : sslOptions
        }
        break
      case 'mariadb':
      case 'mysql':
        dbClient = 'mysql2'

        if (dbUseSSL && _.isPlainObject(dbConfig)) {
          dbConfig.ssl = sslOptions
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
          _.set(dbConfig, 'options.appName', 'Wiki.js')

          dbConfig.enableArithAbort = true
          _.set(dbConfig, 'options.enableArithAbort', true)

          if (dbUseSSL) {
            dbConfig.encrypt = true
            _.set(dbConfig, 'options.encrypt', true)
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

    // Initialize Knex
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
            if (err.code) {
              WIKI.logger.error(`Database Connection Error: ${err.code} ${err.address}:${err.port}`)
            } else {
              WIKI.logger.error(`Database Connection Error: ${err.message}`)
            }
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

    WIKI.logger.info(`Using database driver ${dbClient} for ${WIKI.config.db.type} [ OK ]`)
    this.onReady = Promise.each(initTasksQueue, t => t()).return(true)

    return {
      ...this,
      ...models
    }
  },
  /**
   * Subscribe to database LISTEN / NOTIFY for multi-instances events
   */
  async subscribeToNotifications () {
    const useHA = (WIKI.config.ha === true || WIKI.config.ha === 'true' || WIKI.config.ha === 1 || WIKI.config.ha === '1')
    if (!useHA) {
      return
    } else if (WIKI.config.db.type !== 'postgres') {
      WIKI.logger.warn(`Database engine doesn't support pub/sub. Will not handle concurrent instances: [ DISABLED ]`)
      return
    }

    const PGPubSub = require('pg-pubsub')

    this.listener = new PGPubSub(this.knex.client.connectionSettings, {
      log (ev) {
        WIKI.logger.debug(ev)
      }
    })

    // -> Outbound events handling

    this.listener.addChannel('wiki', payload => {
      if (_.has(payload, 'event') && payload.source !== WIKI.INSTANCE_ID) {
        WIKI.logger.info(`Received event ${payload.event} from instance ${payload.source}: [ OK ]`)
        WIKI.events.inbound.emit(payload.event, payload.value)
      }
    })
    WIKI.events.outbound.onAny(this.notifyViaDB)

    // -> Listen to inbound events

    WIKI.auth.subscribeToEvents()
    WIKI.configSvc.subscribeToEvents()
    WIKI.models.pages.subscribeToEvents()

    WIKI.logger.info(`High-Availability Listener initialized successfully: [ OK ]`)
  },
  /**
   * Unsubscribe from database LISTEN / NOTIFY
   */
  async unsubscribeToNotifications () {
    if (this.listener) {
      WIKI.events.outbound.offAny(this.notifyViaDB)
      WIKI.events.inbound.removeAllListeners()
      this.listener.close()
    }
  },
  /**
   * Publish event via database NOTIFY
   *
   * @param {string} event Event fired
   * @param {object} value Payload of the event
   */
  notifyViaDB (event, value) {
    WIKI.models.listener.publish('wiki', {
      source: WIKI.INSTANCE_ID,
      event,
      value
    })
  }
}
