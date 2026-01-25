import { get, has, isEmpty, isPlainObject } from 'lodash-es'
import path from 'node:path'
import fs from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import PGPubSub from 'pg-pubsub'
import semver from 'semver'

import { createDeferred } from '../helpers/common.mjs'
// import migrationSource from '../db/migrator-source.mjs'
// const migrateFromLegacy = require('../db/legacy')

/**
 * ORM DB module
 */
export default {
  pool: null,
  listener: null,
  config: null,
  VERSION: null,
  LEGACY: false,
  onReady: createDeferred(),
  connectAttempts: 0,
  /**
   * Initialize DB
   */
  async init (workerMode = false) {
    WIKI.logger.info('Checking DB configuration...')

    // Fetch DB Config

    this.config = (!isEmpty(process.env.DATABASE_URL))
      ? {
          connectionString: process.env.DATABASE_URL
        }
      : {
          host: WIKI.config.db.host.toString(),
          user: WIKI.config.db.user.toString(),
          password: WIKI.config.db.pass.toString(),
          database: WIKI.config.db.db.toString(),
          port: WIKI.config.db.port
        }

    // Handle SSL Options

    let dbUseSSL = (WIKI.config.db.ssl === true || WIKI.config.db.ssl === 'true' || WIKI.config.db.ssl === 1 || WIKI.config.db.ssl === '1')
    let sslOptions = null
    if (dbUseSSL && isPlainObject(this.config) && get(WIKI.config.db, 'sslOptions.auto', null) === false) {
      sslOptions = WIKI.config.db.sslOptions
      sslOptions.rejectUnauthorized = sslOptions.rejectUnauthorized !== false
      if (sslOptions.ca && sslOptions.ca.indexOf('-----') !== 0) {
        sslOptions.ca = await fs.readFile(path.resolve(WIKI.ROOTPATH, sslOptions.ca), 'utf-8')
      }
      if (sslOptions.cert) {
        sslOptions.cert = await fs.readFile(path.resolve(WIKI.ROOTPATH, sslOptions.cert), 'utf-8')
      }
      if (sslOptions.key) {
        sslOptions.key = await fs.readFile(path.resolve(WIKI.ROOTPATH, sslOptions.key), 'utf-8')
      }
      if (sslOptions.pfx) {
        sslOptions.pfx = await fs.readFile(path.resolve(WIKI.ROOTPATH, sslOptions.pfx), 'utf-8')
      }
    } else {
      sslOptions = true
    }

    // Handle inline SSL CA Certificate mode
    if (!isEmpty(process.env.DB_SSL_CA)) {
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

    if (dbUseSSL && isPlainObject(this.config)) {
      this.config.ssl = (sslOptions === true) ? { rejectUnauthorized: true } : sslOptions
    }

    // Initialize Postgres Pool

    this.pool = new Pool({
      application_name: 'Wiki.js',
      ...this.config,
      ...workerMode ? { min: 0, max: 1 } : WIKI.config.pool,
      options: `-c search_path=${WIKI.config.db.schema}`
    })

    const db = drizzle({ client: this.pool })

    // Connect
    await this.connect(db)

    // Check DB Version
    const resVersion = await db.execute('SHOW server_version;')
    const dbVersion = semver.coerce(resVersion.rows[0].server_version, { loose: true })
    this.VERSION = dbVersion.version
    if (dbVersion.major < 16) {
      WIKI.logger.error(`Your PostgreSQL database version (${dbVersion.major}) is too old and unsupported by Wiki.js. Requires >= 16. Exiting...`)
      process.exit(1)
    }
    WIKI.logger.info(`Using PostgreSQL v${dbVersion.version} [ OK ]`)

    // DEV - Drop schema
    if (WIKI.config.dev?.dropSchema) {
      WIKI.logger.warn(`DEV MODE - Dropping schema ${WIKI.config.db.schema}...`)
      await db.execute(`DROP SCHEMA IF EXISTS ${WIKI.config.db.schema} CASCADE;`)
    }

    // Run Migrations
    if (!workerMode) {
      await this.syncSchemas(db)
    }

    return db
  },
  /**
   * Subscribe to database LISTEN / NOTIFY for multi-instances events
   */
  async subscribeToNotifications () {
    let connSettings = this.knex.client.connectionSettings
    if (typeof connSettings === 'string') {
      const encodedName = encodeURIComponent(`Wiki.js - ${WIKI.INSTANCE_ID}:PSUB`)
      if (connSettings.indexOf('?') > 0) {
        connSettings = `${connSettings}&ApplicationName=${encodedName}`
      } else {
        connSettings = `${connSettings}?ApplicationName=${encodedName}`
      }
    } else {
      connSettings.application_name = `Wiki.js - ${WIKI.INSTANCE_ID}:PSUB`
    }
    this.listener = new PGPubSub(connSettings, {
      log (ev) {
        WIKI.logger.debug(ev)
      }
    })

    // -> Outbound events handling

    this.listener.addChannel('wiki', payload => {
      if (has(payload, 'event') && payload.source !== WIKI.INSTANCE_ID) {
        WIKI.logger.info(`Received event ${payload.event} from instance ${payload.source}: [ OK ]`)
        WIKI.events.inbound.emit(payload.event, payload.value)
      }
    })
    WIKI.events.outbound.onAny(this.notifyViaDB)

    // -> Listen to inbound events

    WIKI.auth.subscribeToEvents()
    WIKI.configSvc.subscribeToEvents()
    WIKI.db.pages.subscribeToEvents()

    WIKI.logger.info('PG PubSub Listener initialized successfully: [ OK ]')
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
    WIKI.db.listener.publish('wiki', {
      source: WIKI.INSTANCE_ID,
      event,
      value
    })
  },
  /**
   * Attempt initial connection
   */
  async connect (db) {
    try {
      WIKI.logger.info('Connecting to database...')
      await db.execute('SELECT 1 + 1;')
      WIKI.logger.info('Database connection successful [ OK ]')
    } catch (err) {
      WIKI.logger.debug(err)
      if (this.connectAttempts < 10) {
        if (err.code) {
          WIKI.logger.error(`Database connection error: ${err.code} ${err.address}:${err.port}`)
        } else {
          WIKI.logger.error(`Database connection error: ${err.message}`)
        }
        WIKI.logger.warn(`Will retry in 3 seconds... [Attempt ${++this.connectAttempts} of 10]`)
        await setTimeout(3000)
        await this.connect(db)
      } else {
        throw err
      }
    }
  },
  /**
   * Migrate DB Schemas
   */
  async syncSchemas (db) {
    WIKI.logger.info('Ensuring DB schema exists...')
    await db.execute(`CREATE SCHEMA IF NOT EXISTS ${WIKI.config.db.schema}`)
    WIKI.logger.info('Ensuring DB migrations have been applied...')
    return migrate(db, {
      migrationsFolder: path.join(WIKI.SERVERPATH, 'db/migrations'),
      migrationsSchema: WIKI.config.db.schema,
      migrationsTable: 'migrations'
    })
  }
}
