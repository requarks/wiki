/**
 * Ambient declarations for the `WIKI` global singleton.
 *
 * `WIKI` is assembled in `backend/index.ts` (and a minimal subset in `backend/worker.ts`) and is
 * reachable from every module without importing it. Members that come from typed dependencies are
 * typed properly here; the ones backed by our own not-yet-converted modules are left loose and
 * should be replaced with `typeof import('...')` as each module moves to TypeScript.
 */

import type { FastifyInstance } from 'fastify'
import type gracefulServer from '@gquittet/graceful-server'
import type Emittery from 'emittery'
import type NodeCache from 'node-cache'

declare global {
  interface WikiGlobal {
    IS_DEBUG: boolean
    ROOTPATH: string
    SERVERPATH: string
    INSTANCE_ID: string
    startedAt: Temporal.Instant
    version: string
    releaseDate: string
    devMode: boolean

    app: FastifyInstance
    server: ReturnType<typeof gracefulServer>
    cache: NodeCache
    /**
     * HA propagation buses. Event names are dynamic (they travel over postgres NOTIFY), so the
     * event map is left open — `Record<string, any>` is also what makes dataless `emit(name)`
     * calls legal, since Emittery's default `unknown` payload forbids them.
     */
    events: {
      inbound: Emittery<Record<string, any>>
      outbound: Emittery<Record<string, any>>
    }

    auth: {
      groups: Record<string, unknown>
      strategies: Record<string, unknown>
    }

    /**
     * Merged config.yml + base.yml defaults + the `settings` DB table. Assembled at runtime from
     * YAML and JSONB, so it stays intentionally untyped.
     */
    config: any
    /** Contents of `base.yml` — set by configSvc.init(), not by index.ts */
    data: any

    collab: typeof import('../core/collab.ts').default
    configSvc: typeof import('../core/config.ts').default
    db: import('../core/db.ts').WikiDb
    dbManager: typeof import('../core/db.ts').default
    logger: ReturnType<typeof import('../core/logger.ts').default.init>
    scheduler: typeof import('../core/scheduler.ts').default
    models: typeof import('../models/index.ts').default

    // TODO: infer from the `sites` table once db/schema.ts is converted
    sites: Record<string, any>
    sitesMappings: Record<string, string>

    /** Only present in worker threads (see worker.ts) */
    ensureDb?: () => Promise<boolean | void>
  }

  var WIKI: WikiGlobal
}
