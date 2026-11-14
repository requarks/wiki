import type { FastifyRequest } from 'fastify'

/**
 * A site's maintenance mode, set in the Site-wide Banner / Maintenance section of **Admin → General**
 * and stored as `maintenance` in the site's config: `{ mode, bypassGroups }`.
 *
 * - `off` — nothing is held back.
 * - `readonly` — the site can still be read, but nothing a reader does may change the database.
 * - `restricted` — the site is closed: the app shows a maintenance page carrying the banner's title
 *   and contents in place of every screen but the login, and the server serves nothing of the site.
 *
 * Neither mode applies to a requester who holds `manage:system`, or who belongs to one of the site's
 * `bypassGroups`. Everything here asks `effectiveMaintenance`, which already answers `off` for them.
 *
 * Signing in is open in both modes — the login and its continuations, a provider's callback, logout —
 * since that is how a member of a bypass group gets to be recognised as one. So is what the app needs
 * to draw the maintenance page and the login screen. Those routes say so with `config.maintenance`
 * (see `types/fastify.d.ts`); everything else is decided by `maintenanceRefusal`, from the request
 * hook in `index.ts`, before the body is read.
 */

export const MAINTENANCE_MODES = ['off', 'readonly', 'restricted'] as const

export type MaintenanceMode = (typeof MAINTENANCE_MODES)[number]

/** The HTTP methods that read. Every other one is taken to change something. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * The header a refusal carries, naming the mode that refused it, so the app can tell a maintenance
 * refusal apart from any other 503 and switch to the right view without asking again.
 */
export const MAINTENANCE_HEADER = 'X-Wiki-Maintenance'

/** The message a refused request is answered with, per mode. */
const REFUSAL_MESSAGES: Record<Exclude<MaintenanceMode, 'off'>, string> = {
  readonly: 'This site is in read-only maintenance mode. Changes cannot be saved at the moment.',
  restricted: 'This site is closed for maintenance.'
}

/** The mode a site is set to, regardless of who is asking. */
export function siteMaintenanceMode(siteId: string | undefined): MaintenanceMode {
  return (siteId && WIKI.sites[siteId]?.config?.maintenance?.mode) || 'off'
}

/**
 * Whether this requester is unaffected by the site's maintenance mode: they hold `manage:system`, or
 * belong to one of the site's bypass groups.
 *
 * Asked of the requester's actor, so a system API key bypasses through the groups it was issued for
 * and a personal access token through its owner's — the same groups its page rules are judged by.
 * An anonymous request is the guests group, which the admin area never offers as a bypass group and
 * the update route refuses.
 */
export function bypassesMaintenance(req: FastifyRequest, siteId: string | undefined): boolean {
  const actor = WIKI.models.groups.actorForRequest(req)
  if (actor.permissions.includes('manage:system')) {
    return true
  }
  const bypassGroups: string[] =
    (siteId && WIKI.sites[siteId]?.config?.maintenance?.bypassGroups) || []
  return bypassGroups.some((groupId) => actor.groupIds.includes(groupId))
}

/** The site's maintenance mode as it applies to this requester: `off` for one who bypasses it. */
export function effectiveMaintenance(
  req: FastifyRequest,
  siteId: string | undefined
): MaintenanceMode {
  const mode = siteMaintenanceMode(siteId)
  if (mode === 'off' || bypassesMaintenance(req, siteId)) {
    return 'off'
  }
  return mode
}

/**
 * Which site a request is about.
 *
 * The site named in the route when there is one, so that a site in maintenance cannot be reached by
 * way of another site's hostname; otherwise the site the hostname resolves to, which is the site the
 * reader is on for every instance-wide route (users, groups, the system settings).
 */
export function siteIdForRequest(req: FastifyRequest): string | undefined {
  const fromRoute = (req.params as { siteId?: unknown } | undefined)?.siteId
  if (typeof fromRoute === 'string' && WIKI.sites[fromRoute]) {
    return fromRoute
  }
  return WIKI.sitesMappings[req.hostname] || WIKI.sitesMappings['*']
}

/**
 * The surfaces the request hook holds back, by URL. Anything else is either the app shell (whose
 * handler decides for itself — see `renderAppShell`), a websocket (whose controller decides, since a
 * socket refused at the HTTP layer only reconnects), or something that is no part of a site's content
 * and has to keep working for the maintenance page to draw: the static assets, the site's logo and
 * favicon, icons, avatars, compiled blocks, `robots.txt`, the OAuth endpoints a sign-in goes through.
 */
function surfaceOf(urlPath: string): 'api' | 'mcp' | 'content' | null {
  if (urlPath.startsWith('/_api/') || urlPath.startsWith('/_scim/')) {
    return 'api'
  }
  if (urlPath === '/_mcp' || urlPath.startsWith('/_mcp/')) {
    return 'mcp'
  }
  // -> Files, their thumbnails and the list of every public page: content, but never written to
  if (
    urlPath.startsWith('/_files/') ||
    urlPath.startsWith('/_thumb/') ||
    urlPath === '/sitemap.xml'
  ) {
    return 'content'
  }
  return null
}

/**
 * Whether the site's maintenance mode refuses this request, and if so with which mode.
 *
 * - `readonly` refuses every request that writes to the API, except the routes declaring
 *   `config.maintenance` — `open` (signing in) or `read` (a POST that changes nothing). `/_mcp` is let
 *   through: every call on it is a POST, and its tools are held back one by one instead
 *   (`mayCall` in `mcp/tools/index.ts`), so that an agent can go on reading.
 * - `restricted` refuses everything it covers, except the routes declaring `config.maintenance: 'open'`.
 */
export function maintenanceRefusal(req: FastifyRequest): Exclude<MaintenanceMode, 'off'> | null {
  const surface = surfaceOf(req.url.split('?')[0]!)
  if (!surface) {
    return null
  }
  const exemption = req.routeOptions.config?.maintenance
  if (exemption === 'open') {
    return null
  }
  const mode = effectiveMaintenance(req, siteIdForRequest(req))
  if (mode === 'off') {
    return null
  }
  if (mode === 'readonly') {
    const reads = READ_METHODS.has(req.method) || exemption === 'read' || surface === 'mcp'
    return reads ? null : mode
  }
  return mode
}

/** What a refused request is told. */
export function maintenanceRefusalMessage(mode: Exclude<MaintenanceMode, 'off'>): string {
  return REFUSAL_MESSAGES[mode]
}

/**
 * The maintenance block of a site as this requester may see it.
 *
 * `mode` and whether this requester bypasses it (`isBypassed`) for everyone, since the app has to know
 * both to decide what to draw. `bypassGroups` only for a requester who may change it: the site
 * payload is public, and which groups are let through a closed site is the administrators' business.
 */
export function maintenanceForRequest(
  req: FastifyRequest,
  siteId: string
): { mode: MaintenanceMode; isBypassed: boolean; bypassGroups?: string[] } {
  const stored = WIKI.sites[siteId]?.config?.maintenance
  const permissions = WIKI.models.groups.actorForRequest(req).permissions
  const mayManage = permissions.includes('manage:sites') || permissions.includes('manage:system')
  return {
    mode: siteMaintenanceMode(siteId),
    isBypassed: bypassesMaintenance(req, siteId),
    ...(mayManage ? { bypassGroups: stored?.bypassGroups ?? [] } : {})
  }
}
