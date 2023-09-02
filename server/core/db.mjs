import { create, get, has, isEmpty, isPlainObject } from 'lodash-es'
import path from 'node:path'
import knex from 'knex'
import fs from 'node:fs/promises'
import Objection from 'objection'
import PGPubSub from 'pg-pubsub'
import semver from 'semver'

import { createDeferred } from '../helpers/common.mjs'
import migrationSource from '../db/migrator-source.mjs'
// const migrateFromLegacy = require('../db/legacy')
import { setTimeout } from 'node:timers/promises'

/**
 * ORM DB module
 */
export default {
  Objection,
  knex: null,
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

    this.config = (!isEmpty(process.env.DATABASE_URL)) ? process.env.DATABASE_URL : {
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

    // Initialize Knex
    this.knex = knex({
      client: 'pg',
      useNullAsDefault: true,
      asyncStackTraces: WIKI.IS_DEBUG,
      connection: this.config,
      searchPath: [WIKI.config.db.schema],
      pool: {
        ...workerMode ? { min: 0, max: 1 } : WIKI.config.pool,
        async afterCreate(conn, done) {
          // -> Set Connection App Name
          if (workerMode) {
            await conn.query(`set application_name = 'Wiki.js - ${WIKI.INSTANCE_ID}'`)
          } else {
            await conn.query(`set application_name = 'Wiki.js - ${WIKI.INSTANCE_ID}:MAIN'`)
          }
          done()
        }
      },
      debug: WIKI.IS_DEBUG
    })

    Objection.Model.knex(this.knex)

    // Load DB Models
    WIKI.logger.info('Loading DB models...')
    const models = (await import(path.join(WIKI.SERVERPATH, 'models/index.mjs'))).default

    // Connect
    await this.connect()

    // Check DB Version
    const resVersion = await this.knex.raw('SHOW server_version;')
    const dbVersion = semver.coerce(resVersion.rows[0].server_version, { loose: true })
    this.VERSION = dbVersion.version
    this.LEGACY = dbVersion.major < 16
    if (dbVersion.major < 12) {
      WIKI.logger.error(`Your PostgreSQL database version (${dbVersion.major}) is too old and unsupported by Wiki.js. Requires >= 12. Exiting...`)
      process.exit(1)
    }
    WIKI.logger.info(`PostgreSQL ${dbVersion.version} [ ${this.LEGACY ? 'LEGACY MODE' : 'OK'} ]`)

    // Run Migrations
    if (!workerMode) {
      await this.migrateFromLegacy()
      await this.syncSchemas()
    }

    return {
      ...this,
      ...models
    }
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

    WIKI.logger.info(`PG PubSub Listener initialized successfully: [ OK ]`)
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
  async connect () {
    try {
      WIKI.logger.info('Connecting to database...')
      await this.knex.raw('SELECT 1 + 1;')
      WIKI.logger.info('Database Connection Successful [ OK ]')
    } catch (err) {
      if (this.connectAttempts < 10) {
        if (err.code) {
          WIKI.logger.error(`Database Connection Error: ${err.code} ${err.address}:${err.port}`)
        } else {
          WIKI.logger.error(`Database Connection Error: ${err.message}`)
        }
        WIKI.logger.warn(`Will retry in 3 seconds... [Attempt ${++this.connectAttempts} of 10]`)
        await setTimeout(3000)
        await this.connect()
      } else {
        throw err
      }
    }
  },
  /**
   * Migrate DB Schemas
   */
  async syncSchemas () {
    WIKI.logger.info('Ensuring DB schema exists...')
    await this.knex.raw(`CREATE SCHEMA IF NOT EXISTS ${WIKI.config.db.schema}`)
    WIKI.logger.info('Ensuring DB migrations have been applied...')
    return this.knex.migrate.latest({
      tableName: 'migrations',
      migrationSource,
      schemaName: WIKI.config.db.schema
    })
  },
  /**
   * Migrate DB Schemas from 2.x
   */
  async migrateFromLegacy () {
    // return migrateFromLegacy.migrate(self.knex)
  }
}
