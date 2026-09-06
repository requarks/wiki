import { Gauge, Registry, collectDefaultMetrics } from 'prom-client'
import { eq, sql } from 'drizzle-orm'

import { RESERVED_ROOT_FILES } from '../helpers/common.ts'
import { classifyClientIp } from '../helpers/network.ts'
import type { ClientIpClass } from '../helpers/network.ts'
import {
  assets as assetsTable,
  groups as groupsTable,
  jobs as jobsTable,
  pageEditSubmissions as submissionsTable,
  pages as pagesTable,
  sites as sitesTable,
  tags as tagsTable,
  users as usersTable
} from '../db/schema.ts'

/** Fields stored in the `metrics` settings blob. */
export const METRICS_FIELDS = [
  'isEnabled',
  'path',
  'allowAnonymousLocal',
  'allowAnonymousPrivate',
  'allowAnonymousExternal',
  'includeRuntime',
  'includeWiki'
] as const

/** The permission a scrape needs when its address is not one anonymous access was opened to. */
export const METRICS_PERMISSION = 'read:metrics'

/**
 * Which anonymous-access setting each address class is opened by.
 *
 * The classes come from `helpers/network.ts`; this is the only place that ties one to a setting, so
 * adding a class is a matter of naming its field here.
 */
const ANONYMOUS_FIELD_BY_CLASS: Record<ClientIpClass, (typeof METRICS_FIELDS)[number]> = {
  local: 'allowAnonymousLocal',
  private: 'allowAnonymousPrivate',
  external: 'allowAnonymousExternal'
}

/**
 * The runtime registry, built once.
 *
 * `collectDefaultMetrics` attaches collectors to a registry permanently, and some of them (the GC
 * histogram, the event loop lag probe) hold a handle open for the life of the process — so it has to
 * happen once, not per scrape, and not at import time either: a wiki that never turns metrics on
 * should not be carrying the probes.
 */
let runtimeRegistry: Registry | null = null

function runtimeRegistryFor(): Registry {
  if (!runtimeRegistry) {
    runtimeRegistry = new Registry()
    collectDefaultMetrics({ register: runtimeRegistry })
  }
  return runtimeRegistry
}

/**
 * Metrics model
 *
 * The Prometheus endpoint: the `metrics` settings blob the admin area edits, the decision about who
 * may scrape it, and the exposition itself.
 *
 * Everything here is read per request through the `WIKI` global rather than captured at boot, so a
 * change to the path or to who may reach it applies at once and on every instance — `saveToDb`
 * propagates as `reloadConfig`, whose handler REPLACES `WIKI.config`.
 */
class Metrics {
  /**
   * The metrics configuration as the admin area expects it
   */
  getConfig(): Record<string, any> {
    const metrics = WIKI.config.metrics ?? {}
    const config: Record<string, any> = {}
    for (const field of METRICS_FIELDS) {
      config[field] = metrics[field]
    }
    return config
  }

  /**
   * Keep only the fields this model owns, dropping anything else a client sends
   */
  pickFields(body: Record<string, any>): Record<string, any> {
    const patch: Record<string, any> = {}
    for (const field of METRICS_FIELDS) {
      if (body[field] !== undefined) {
        patch[field] = body[field]
      }
    }
    return patch
  }

  /**
   * Reduce a path to the single form it is compared against a request in.
   *
   * Wrapping and doubled slashes go and one leading slash is put back, so `metrics/`, `/metrics` and
   * `//metrics//` are the same endpoint. Casing is left alone: a URL path is case-sensitive, and an
   * administrator who writes `/Metrics` means that.
   */
  normalizePath(input: unknown): string {
    const segments = `${input ?? ''}`.trim().split('/').filter(Boolean)
    return segments.length > 0 ? `/${segments.join('/')}` : ''
  }

  /**
   * Check a patch against the settings it will end up merged with.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validate(patch: Record<string, any>): string | null {
    const merged = { ...this.getConfig(), ...patch }

    const path = this.normalizePath(merged.path)
    if (!path) {
      return 'The metrics path must name at least one segment, e.g. /metrics.'
    }
    if (/[\s?#]/.test(path)) {
      return 'The metrics path cannot contain whitespace, a query string or a fragment.'
    }
    const firstSegment = path.split('/')[1] ?? ''
    /*
      The two namespaces that are not the wiki's to give away. A leading underscore is where the
      server itself mounts (`/_api`, `/_files`, …) and where the frontend router expects its own
      screens; the reserved root files are what a browser or a crawler asks for by convention. The
      endpoint deliberately shadows a PAGE — that is the point of it — but shadowing the API or the
      admin area would break the instance from a screen that cannot then be reached to undo it.
    */
    if (firstSegment.startsWith('_')) {
      return 'The metrics path cannot start with an underscore segment — those belong to the wiki itself.'
    }
    if (RESERVED_ROOT_FILES.has(path.slice(1).toLowerCase())) {
      return `${path} is reserved.`
    }

    if (!merged.includeRuntime && !merged.includeWiki) {
      return 'At least one group of metrics must be included, otherwise the endpoint has nothing to serve.'
    }

    return null
  }

  /**
   * Save a validated patch, normalizing the path as it goes.
   *
   * @returns Whether the settings were saved
   */
  async updateConfig(patch: Record<string, any>): Promise<boolean> {
    const normalized = { ...patch }
    if (normalized.path !== undefined) {
      normalized.path = this.normalizePath(normalized.path)
    }

    const previousConfig = WIKI.config.metrics
    WIKI.config.metrics = { ...previousConfig, ...normalized }

    if (!(await WIKI.configSvc.saveToDb(['metrics']))) {
      WIKI.config.metrics = previousConfig
      return false
    }
    return true
  }

  /** Whether the endpoint is turned on at all. */
  isEnabled(): boolean {
    return WIKI.config.metrics?.isEnabled === true
  }

  /**
   * Whether this URL path is the metrics endpoint.
   *
   * False whenever the endpoint is off, which is what leaves a page at that path serving normally:
   * nothing is registered as a route, so with metrics disabled the request carries on to the page
   * tree exactly as it would have.
   *
   * The comparison forgives a trailing slash, since the server does elsewhere (`ignoreTrailingSlash`,
   * and the redirect in the SEO hook) and a scrape configuration is written by hand.
   */
  matches(urlPath: string): boolean {
    if (!this.isEnabled()) {
      return false
    }
    const configured = this.normalizePath(WIKI.config.metrics?.path)
    return configured.length > 0 && this.normalizePath(urlPath) === configured
  }

  /**
   * Whether a scrape from this address may skip authentication.
   */
  allowsAnonymous(ip: string | null | undefined): boolean {
    const field = ANONYMOUS_FIELD_BY_CLASS[classifyClientIp(ip)]
    return WIKI.config.metrics?.[field] === true
  }

  /**
   * The exposition, in the Prometheus text format.
   *
   * The two groups are separate registries rather than one: the runtime collectors are attached for
   * the life of the process, while the wiki gauges are read from the database and are therefore built
   * and thrown away per scrape. Their outputs concatenate because the format is line-based and each
   * metric carries its own HELP and TYPE.
   *
   * `groups` overrides which of the two are collected, for the admin area's preview: it renders what
   * the form in front of the operator says rather than what was last saved, so that ticking a box and
   * looking is one step instead of two. A scrape passes nothing and gets the stored settings.
   */
  async render(groups?: {
    includeRuntime?: boolean
    includeWiki?: boolean
  }): Promise<{ contentType: string; body: string }> {
    const config = WIKI.config.metrics ?? {}
    const parts: string[] = []

    // -> Both read as opt-in rather than opt-out: `base.yml` gives every instance both keys, so an
    //    absent one is not a setting to be read generously — and the wiki group defaults to off
    if ((groups?.includeRuntime ?? config.includeRuntime) === true) {
      parts.push(await runtimeRegistryFor().metrics())
    }
    if ((groups?.includeWiki ?? config.includeWiki) === true) {
      parts.push(await (await this.collectWikiMetrics()).metrics())
    }

    return {
      contentType: Registry.PROMETHEUS_CONTENT_TYPE,
      body: parts.filter(Boolean).join('\n')
    }
  }

  /**
   * A registry holding this instance's view of the wiki, read fresh.
   *
   * Every count is cluster-wide — they come out of the database, which every instance shares — with
   * the exception of `wiki_info`'s instance id and the uptime, which are this process's. A scrape
   * that lands on a different instance of an HA set therefore reports the same wiki and a different
   * uptime, which is what those two labels are for.
   */
  private async collectWikiMetrics(): Promise<Registry> {
    const register = new Registry()

    const gauge = (name: string, help: string) => new Gauge({ name, help, registers: [register] })

    const [
      pagesTotal,
      usersTotal,
      usersActive,
      groupsTotal,
      sitesTotal,
      tagsTotal,
      assetsAggregate,
      jobsQueued,
      jobsActive,
      submissionsPending,
      schedulerHealthy
    ] = await Promise.all([
      WIKI.db.$count(pagesTable),
      WIKI.db.$count(usersTable, eq(usersTable.isSystem, false)),
      WIKI.db.$count(usersTable, sql`${usersTable.isSystem} = false AND ${usersTable.isActive}`),
      WIKI.db.$count(groupsTable),
      WIKI.db.$count(sitesTable),
      WIKI.db.$count(tagsTable),
      WIKI.db
        .select({
          total: sql<number>`count(*)::int`,
          bytes: sql<number>`coalesce(sum(${assetsTable.fileSize}), 0)::bigint`
        })
        .from(assetsTable),
      WIKI.db.$count(jobsTable),
      WIKI.models.jobs.countActive(),
      WIKI.db.$count(submissionsTable),
      WIKI.models.jobs.isHealthy()
    ])

    new Gauge({
      name: 'wiki_info',
      help: 'Wiki.js build and instance this scrape was answered by. Always 1.',
      labelNames: ['version', 'instance'],
      registers: [register]
    }).set({ version: WIKI.version, instance: WIKI.INSTANCE_ID }, 1)

    gauge('wiki_start_time_seconds', 'Unix time at which this instance finished booting.').set(
      WIKI.startedAt.epochMilliseconds / 1000
    )
    gauge('wiki_pages_total', 'Pages across every site and locale.').set(pagesTotal)
    gauge('wiki_users_total', 'User accounts, excluding the system accounts.').set(usersTotal)
    gauge('wiki_users_active_total', 'User accounts that are active, i.e. able to log in.').set(
      usersActive
    )
    gauge('wiki_groups_total', 'Groups.').set(groupsTotal)
    gauge('wiki_sites_total', 'Sites served by this wiki.').set(sitesTotal)
    gauge('wiki_tags_total', 'Distinct tags in use.').set(tagsTotal)
    gauge('wiki_assets_total', 'Uploaded files.').set(assetsAggregate[0]?.total ?? 0)
    gauge('wiki_assets_size_bytes', 'Total size of uploaded files.').set(
      Number(assetsAggregate[0]?.bytes ?? 0)
    )
    gauge('wiki_jobs_queued', 'Jobs waiting to be picked up by an instance.').set(jobsQueued)
    gauge('wiki_jobs_active', 'Jobs running right now, across every instance.').set(jobsActive)
    gauge('wiki_page_edit_submissions_pending', 'Suggested edits waiting for a reviewer.').set(
      submissionsPending
    )
    gauge(
      'wiki_scheduler_healthy',
      'Whether some instance is still queueing scheduled jobs. 1 or 0.'
    ).set(schedulerHealthy ? 1 : 0)

    return register
  }
}

export const metrics = new Metrics()
