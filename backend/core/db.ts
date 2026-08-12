import { isPlainObject } from 'es-toolkit/predicate'
import path from 'node:path'
import fs from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool, type PoolClient, type PoolConfig } from 'pg'
import { parse } from 'pg-connection-string'
import semver from 'semver'

import { relations } from '../db/relations.ts'
import { flags } from '../models/flags.ts'
import { createDeferred } from '../helpers/common.ts'
import { createNotifier } from '../helpers/pubsub.ts'
// import migrationSource from '../db/migrator-source.js'

/**
 * Sends the event bus's cross-instance notifications, one at a time.
 *
 * Built here rather than on the object below because `notifyViaDB` is handed to Emittery as a bare
 * listener and so has no `this` to reach it through. The client is read per send for the same reason
 * it is elsewhere: it does not exist until `subscribeToNotifications`.
 */
const notifier = createNotifier(() => WIKI.dbManager.pubsubClient, 'event bus')

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
 * Tables whose presence means the database belongs to a Wiki.js 2.x installation.
 *
 * `knex_migrations` is the 2.x migration ledger — 3.x tracks its own in `migrations`, via Drizzle —
 * and `searchEngines` is a 2.x-only table, kept as a second signal for a database whose migration
 * ledger somebody has dropped or renamed. Either one is enough: 3.x creates neither, so seeing one
 * cannot be a 3.x database. The names are the exact identifiers 2.x created, `searchEngines`
 * included, so they are compared case-sensitively against `information_schema`.
 */
const LEGACY_TABLES = ['knex_migrations', 'searchEngines']

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

    await this.pubsubClient.query('LISTEN wiki')
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
      // -> Whatever the last events queued goes out before the client goes: releasing it from under a
      //    notification in flight would fail that one for no reason
      await notifier.drained()
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
    notifier.send(
      'wiki',
      JSON.stringify({
        source: WIKI.INSTANCE_ID,
        event: name,
        value: data ?? null
      })
    )
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
   * Refuse to run against a Wiki.js 2.x database.
   *
   * Checked before anything is created or migrated, because there is no upgrade path: the 3.x
   * migrations would run over the 2.x tables they know nothing about and leave a database that is
   * neither version. Exits rather than throws — a 2.x database is not something a retry or a later
   * boot phase can recover from, and the operator has to point the config at a fresh one.
   */
  async checkForLegacyInstall(db: WikiDb): Promise<void> {
    const res = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = ${WIKI.config.db.schema} AND table_name IN ${LEGACY_TABLES}
      LIMIT 1
    `)
    if (res.rows.length > 0) {
      WIKI.logger.error('ERROR: UPGRADING FROM A 2.x INSTALLATION IS NOT YET SUPPORTED. Exiting...')
      WIKI.logger.error(
        `Found the Wiki.js 2.x table "${res.rows[0].table_name}" in schema "${WIKI.config.db.schema}".`
      )
      process.exit(1)
    }
  },
  /**
   * Migrate DB Schemas
   */
  async syncSchemas(db: WikiDb) {
    await this.checkForLegacyInstall(db)

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
