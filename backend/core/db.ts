import { isPlainObject } from 'es-toolkit/predicate'
import path from 'node:path'
import fs from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool, type PoolClient, type PoolConfig } from 'pg'
import { parse } from 'pg-connection-string'
import semver from 'semver'

import { relations } from '../db/relations.ts'
import { flags } from '../models/flags.ts'
import { createDeferred } from '../helpers/common.ts'
// import migrationSource from '../db/migrator-source.js'
// const migrateFromLegacy = require('../db/legacy')

/**
 * Postgres extensions the schema depends on, installed before the migrations run.
 *
 * `ltree` types the folder paths of the page tree and answers the ancestor queries the navigation is
 * built from; `pg_trgm` backs fuzzy text matching. `pgcrypto` used to be here for `gen_random_uuid()`,
 * which every primary key defaults to — that has been core since Postgres 13, and 16 is the minimum
 * this runs on, so nothing needs it any more.
 */
const REQUIRED_EXTENSIONS = ['ltree', 'pg_trgm']

/**
 * Query logger, consulted by Drizzle on every query.
 *
 * The decision is made per query rather than when the instance is built, so that the `sqlLog` system
 * flag can be turned on in the admin area and take effect on the next query — a logger chosen at boot
 * would need a restart.
 */
const queryLogger = {
  logQuery(query: string, params: unknown[]): void {
    if (!flags.isEnabled('sqlLog') && !WIKI.config.dev?.logQueries) {
      return
    }
    WIKI.logger.info(`[SQL] ${query}${params.length > 0 ? ` -- ${JSON.stringify(params)}` : ''}`)
  }
}

/**
 * Build the Drizzle instance.
 *
 * `logger` is passed unconditionally rather than spread in from a conditional: a spread in the config
 * literal collapses the inferred relations to `EmptyRelations`, which would untype the whole
 * `db.query.*` relational API.
 */
function createDb(client: Pool) {
  return drizzle({ client, relations, logger: queryLogger })
}

/** The Drizzle instance, as returned by `init()` and exposed as `WIKI.db`. */
export type WikiDb = ReturnType<typeof createDb>

/**
 * ORM DB module
 */
export default {
  pool: null as Pool | null,
  pubsubClient: null as PoolClient | null,
  config: null as PoolConfig | null,
  dbName: null as string | null | undefined,
  VERSION: null as string | null,
  LEGACY: false,
  onReady: createDeferred(),
  connectAttempts: 0,
  /**
   * Initialize DB
   */
  async init(workerMode = false): Promise<WikiDb> {
    WIKI.logger.info('Checking DB configuration...')

    // Fetch DB Config

    if (process.env.DATABASE_URL) {
      this.config = {
        connectionString: process.env.DATABASE_URL
      }
      this.dbName = parse(process.env.DATABASE_URL).database
    } else {
      this.config = {
        host: WIKI.config.db.host.toString(),
        user: WIKI.config.db.user.toString(),
        password: WIKI.config.db.pass.toString(),
        database: WIKI.config.db.db.toString(),
        port: WIKI.config.db.port
      }
      this.dbName = this.config.database
    }

    // Handle SSL Options

    let dbUseSSL =
      WIKI.config.db.ssl === true ||
      WIKI.config.db.ssl === 'true' ||
      WIKI.config.db.ssl === 1 ||
      WIKI.config.db.ssl === '1'
    let sslOptions: any = null
    if (dbUseSSL && isPlainObject(this.config) && WIKI.config.db?.sslOptions?.auto === false) {
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
    if (process.env.DB_SSL_CA) {
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
      this.config.ssl = sslOptions === true ? { rejectUnauthorized: true } : sslOptions
    }

    // Initialize Postgres Pool

    this.pool = new Pool({
      application_name: `Wiki.js - ${WIKI.INSTANCE_ID}:${workerMode ? 'WORKER' : 'MAIN'}`,
      ...this.config,
      ...(workerMode ? { min: 0, max: 1 } : WIKI.config.pool),
      options: `-c search_path=${WIKI.config.db.schema}`
    })

    const db = createDb(this.pool)

    // Connect
    await this.connect(db)

    // Check DB Version
    const resVersion = await db.execute('SHOW server_version;')
    const dbVersion = semver.coerce(resVersion.rows[0].server_version as string, { loose: true })!
    this.VERSION = dbVersion.version
    if (dbVersion.major < 16) {
      WIKI.logger.error(
        `Your PostgreSQL database version (${dbVersion.major}) is too old and unsupported by Wiki.js. Requires >= 16. Exiting...`
      )
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
  async subscribeToNotifications(): Promise<void> {
    const connectionAppName = `Wiki.js - ${WIKI.INSTANCE_ID}:EVENTS`
    this.pubsubClient = await this.pool!.connect()
    await this.pubsubClient.query(`SET application_name = '${connectionAppName}'`)

    // -> Outbound events handling

    this.pubsubClient.query('LISTEN wiki')
    this.pubsubClient.on('notification', (msg) => {
      if (msg.channel !== 'wiki') {
        return
      }
      try {
        const decoded = JSON.parse(msg.payload!)
        if ('event' in decoded && decoded.source !== WIKI.INSTANCE_ID) {
          WIKI.logger.info(
            `Received event ${decoded.event} from instance ${decoded.source}: [ OK ]`
          )
          WIKI.events.inbound.emit(decoded.event, decoded.value)
        }
      } catch {}
    })
    // FIXME: pre-existing bug — Emittery's `onAny` calls the listener as `(eventName, eventData)`,
    // but `notifyViaDB` destructures a single `{ name, data }` object (the eventemitter2 signature
    // it was written against). Both end up undefined, so HA event propagation publishes an empty
    // event. Preserved as-is to keep the TypeScript migration behavior-neutral.
    WIKI.events.outbound.onAny(this.notifyViaDB as any)

    // -> Listen to inbound events

    // WIKI.auth.subscribeToEvents()
    WIKI.configSvc.subscribeToEvents()
    // WIKI.db.pages.subscribeToEvents()

    WIKI.logger.info('Event Listener initialized successfully: [ OK ]')
  },
  /**
   * Unsubscribe from database LISTEN / NOTIFY
   */
  async unsubscribeFromNotifications(): Promise<void> {
    if (this.pubsubClient) {
      WIKI.events.outbound.offAny(this.notifyViaDB as any)
      WIKI.events.inbound.clearListeners()
      this.pubsubClient.release(true)
    }
  },
  /**
   * Publish event via database NOTIFY
   *
   * @param event Event fired
   * @param value Payload of the event
   */
  notifyViaDB({ name, data }: { name?: string; data?: unknown }): void {
    try {
      WIKI.dbManager.pubsubClient!.query(`SELECT pg_notify($1, $2)`, [
        'wiki',
        JSON.stringify({
          source: WIKI.INSTANCE_ID,
          event: name,
          value: data ?? null
        })
      ])
    } catch (err: any) {
      WIKI.logger.warn(err)
    }
  },
  /**
   * Attempt initial connection
   */
  async connect(db: WikiDb): Promise<void> {
    try {
      WIKI.logger.info('Connecting to database...')
      await db.execute('SELECT 1 + 1;')
      WIKI.logger.info('Database connection successful [ OK ]')
    } catch (err: any) {
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
  async syncSchemas(db: WikiDb) {
    WIKI.logger.info('Ensuring DB schema exists...')
    await db.execute(`CREATE SCHEMA IF NOT EXISTS ${WIKI.config.db.schema}`)

    /*
      Here rather than at the top of the first migration, for the same reason the schema itself is:
      the migrations need these to exist and cannot express them.

      `drizzle-kit generate` builds a migration by diffing the schema definition against the previous
      snapshot, and an extension is part of neither — so a hand-written `CREATE EXTENSION` preamble
      survives only until somebody regenerates, at which point the very first migration fails on the
      `ltree` column it can no longer create. Stated here, that cannot happen.

      Idempotent, so a database whose extensions an administrator installed by hand is untouched.
    */
    WIKI.logger.info('Ensuring required DB extensions are installed...')
    for (const extension of REQUIRED_EXTENSIONS) {
      await db.execute(`CREATE EXTENSION IF NOT EXISTS ${extension}`)
    }

    WIKI.logger.info('Ensuring DB migrations have been applied...')
    return migrate(db, {
      migrationsFolder: path.join(WIKI.SERVERPATH, 'db/migrations'),
      migrationsSchema: WIKI.config.db.schema,
      migrationsTable: 'migrations'
    })
  }
}
