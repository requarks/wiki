import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import { durationToSeconds } from '../helpers/common.ts'
import { groups as groupsTable, userGroups, users as usersTable } from '../db/schema.ts'
import { matchesIpRanges, parseIpRange } from '../helpers/network.ts'
import type { RateLimitPolicy } from './rateLimits.ts'
import type { GroupPatch } from './groups.ts'
import type { UserPatch } from './users.ts'

/**
 * SCIM 2.0 provisioning — RFC 7643 (schema) and RFC 7644 (protocol).
 *
 * The other half of single sign-on. SAML and OIDC answer *who is this person signing in*; SCIM
 * answers *who exists, who is in what group, and who left on Friday*. Without it the wiki learns
 * about a person on their first login and never learns that they are gone — their account stays
 * active and their session cookie stays good for thirty days after the directory disabled them.
 *
 * This model owns the mapping between a SCIM resource and the wiki's rows, the filter grammar, the
 * PATCH interpretation and the data operations. It deliberately owns none of the authorization:
 * every guard is a question about the CALLER and lives in `helpers/userGuards.ts`, applied by
 * `controllers/scim.ts` — the same guards the admin API goes through, so that a directory cannot do
 * through `/_scim` what an administrator may not do through `/_api`.
 *
 * Served at `/_scim/v2` rather than under `/_api`: SCIM has its own error body, its own content
 * type and its own discovery documents, none of which belong in this wiki's REST conventions.
 */

/** What a request must hold to drive provisioning. See `ELEVATED_PERMISSIONS` in `models/groups.ts`. */
export const SCIM_PERMISSION = 'manage:scim'

export const SCHEMA_USER = 'urn:ietf:params:scim:schemas:core:2.0:User'
export const SCHEMA_GROUP = 'urn:ietf:params:scim:schemas:core:2.0:Group'
export const SCHEMA_LIST = 'urn:ietf:params:scim:api:messages:2.0:ListResponse'
export const SCHEMA_ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error'
export const SCHEMA_PATCH_OP = 'urn:ietf:params:scim:api:messages:2.0:PatchOp'

/** The media type RFC 7644 §3.1 gives every SCIM request and response. */
export const SCIM_CONTENT_TYPE = 'application/scim+json'

/** How many resources one page may carry, however large a `count` is asked for. */
export const SCIM_MAX_RESULTS = 200

/** The page size used when a client asks for none. */
const SCIM_DEFAULT_COUNT = 100

/**
 * A refusal, in the shape RFC 7644 §3.12 gives one.
 *
 * `scimType` is the machine-readable half and is what a connector branches on — `uniqueness` tells
 * it to go and match an existing account instead of creating a second one, where a bare 409 tells it
 * nothing. Separate from `CustomError` for exactly that reason: the two error bodies are different
 * shapes and `controllers/scim.ts` has its own error handler to emit this one.
 */
export class ScimError extends Error {
  statusCode: number
  scimType?: string

  constructor(statusCode: number, message: string, scimType?: string) {
    super(message)
    this.name = 'ScimError'
    this.statusCode = statusCode
    this.scimType = scimType
  }
}

export const SCIM_DELETE_ACTIONS = ['deactivate', 'delete'] as const
export type ScimDeleteAction = (typeof SCIM_DELETE_ACTIONS)[number]

export const SCIM_EMAIL_SOURCES = ['userName', 'emails'] as const
export type ScimEmailSource = (typeof SCIM_EMAIL_SOURCES)[number]

/** The settings blob this model owns, as the admin area reads and writes it. */
export interface ScimConfig {
  isEnabled: boolean
  deleteAction: ScimDeleteAction
  emailSource: ScimEmailSource
  allowGroupCreate: boolean
  rateLimitEnabled: boolean
  /** Requests allowed per address within the window. The one that exceeds it earns the ban. */
  rateLimitMax: number
  /** Window and ban as an operator writes them (`1m`, `30s`, `1h`), like the auth limit's. */
  rateLimitWindow: string
  rateLimitBan: string
  /** Addresses allowed to reach the endpoint, as single addresses or CIDR subnets. */
  ipAllowList: string[]
}

/**
 * The limit used until an administrator saves their own, and whenever a stored value is unusable.
 *
 * Deliberately far looser than the login limit next door, because the traffic is not the same
 * shape: guessing a password is one request at a time, while a directory's first sync is every user
 * it has, back to back. A limit set for the former would refuse the latter for doing its job.
 */
const RATE_LIMIT_DEFAULTS: RateLimitPolicy = {
  max: 600,
  windowSeconds: 60,
  banSeconds: 60
}

/**
 * The last request this instance answered, for the admin screen's status card.
 *
 * In memory and per instance, like the runtime metrics registry: it exists so that somebody setting
 * a connector up can see whether anything is arriving at all and what it was told, which is the
 * question the server log otherwise answers. Nothing depends on it, and an instance that has just
 * started has none.
 */
export interface ScimLastRequest {
  at: string
  method: string
  path: string
  status: number
  message: string | null
}

let lastRequest: ScimLastRequest | null = null

/** A SCIM resource as a client sends it, or the fragment a PATCH assembles. */
type ScimResource = Record<string, any>

/** Postgres gives back a `Date`; SCIM wants an RFC 3339 string. */
function instantOf(value: Date | null | undefined): string | undefined {
  return value ? value.toTemporalInstant().toString({ smallestUnit: 'millisecond' }) : undefined
}

/**
 * Whether a value that arrived as JSON means true.
 *
 * Connectors are inconsistent about `active`: the RFC says boolean, and both `"True"` and `"false"`
 * turn up as strings in the wild. A string is read for what it says rather than for being non-empty,
 * since `"false"` is truthy to JavaScript and would activate an account the directory just disabled.
 */
function readBoolean(value: any): boolean {
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }
  return Boolean(value)
}

/**
 * Whether a string is an address this wiki can file an account under.
 *
 * Deliberately crude — one `@`, something either side, no spaces. The wiki keys accounts by email
 * and does not verify one that arrived from a directory, so this is a check that the value is the
 * right KIND of thing, not that it is deliverable.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export class Scim {
  // ==========================================
  // CONFIGURATION
  // ==========================================

  /** The settings, defaulted field by field so that a blob written before a field existed still reads. */
  getConfig(): ScimConfig {
    const scim = WIKI.config.scim ?? {}
    return {
      isEnabled: scim.isEnabled === true,
      deleteAction: SCIM_DELETE_ACTIONS.includes(scim.deleteAction)
        ? scim.deleteAction
        : 'deactivate',
      emailSource: SCIM_EMAIL_SOURCES.includes(scim.emailSource) ? scim.emailSource : 'userName',
      allowGroupCreate: scim.allowGroupCreate !== false,
      rateLimitEnabled: scim.rateLimitEnabled !== false,
      rateLimitMax:
        Number.isFinite(Number(scim.rateLimitMax)) && Number(scim.rateLimitMax) > 0
          ? Math.floor(Number(scim.rateLimitMax))
          : RATE_LIMIT_DEFAULTS.max,
      rateLimitWindow: typeof scim.rateLimitWindow === 'string' ? scim.rateLimitWindow : '1m',
      rateLimitBan: typeof scim.rateLimitBan === 'string' ? scim.rateLimitBan : '1m',
      ipAllowList: Array.isArray(scim.ipAllowList)
        ? scim.ipAllowList.filter((entry: unknown) => typeof entry === 'string' && entry.length > 0)
        : []
    }
  }

  /**
   * The limit as `rateLimits.consume` wants it.
   *
   * Every field falls back on its own, so one unusable value leaves the rest of the limit standing
   * rather than turning it off — the same arrangement the auth limit makes, and for the same
   * reason: a typo in the ban duration must not silently remove the ceiling.
   */
  rateLimitPolicy(): RateLimitPolicy {
    const config = this.getConfig()
    return {
      max: config.rateLimitMax,
      windowSeconds: durationToSeconds(config.rateLimitWindow, RATE_LIMIT_DEFAULTS.windowSeconds),
      banSeconds: durationToSeconds(config.rateLimitBan, RATE_LIMIT_DEFAULTS.banSeconds)
    }
  }

  /**
   * Whether this address may reach the endpoint at all.
   *
   * An empty allow list means every address, so the restriction is off until somebody writes one —
   * see `matchesIpRanges`. What an address MEANS depends on `security.trustProxy`: with it off, a
   * wiki behind a proxy sees the proxy for every request, and a list of the directory's published
   * egress ranges would then refuse everybody. The admin screen says so beside the field.
   */
  isAddressAllowed(ip: string | null | undefined): boolean {
    return matchesIpRanges(ip, this.getConfig().ipAllowList)
  }

  /** Whether provisioning is turned on. Read per request, so a change applies at once. */
  isEnabled(): boolean {
    return WIKI.config.scim?.isEnabled === true
  }

  /** Keep only the fields this model owns, dropping anything else a client sends. */
  pickFields(body: Record<string, any>): Partial<ScimConfig> {
    const patch: Record<string, any> = {}
    if (body.isEnabled !== undefined) {
      patch.isEnabled = Boolean(body.isEnabled)
    }
    if (body.allowGroupCreate !== undefined) {
      patch.allowGroupCreate = Boolean(body.allowGroupCreate)
    }
    if (body.deleteAction !== undefined) {
      patch.deleteAction = body.deleteAction
    }
    if (body.emailSource !== undefined) {
      patch.emailSource = body.emailSource
    }
    if (body.rateLimitEnabled !== undefined) {
      patch.rateLimitEnabled = Boolean(body.rateLimitEnabled)
    }
    if (body.rateLimitMax !== undefined) {
      patch.rateLimitMax = Number(body.rateLimitMax)
    }
    if (body.rateLimitWindow !== undefined) {
      patch.rateLimitWindow = String(body.rateLimitWindow).trim()
    }
    if (body.rateLimitBan !== undefined) {
      patch.rateLimitBan = String(body.rateLimitBan).trim()
    }
    if (body.ipAllowList !== undefined) {
      /*
        Normalised on the way in rather than at match time, so what is stored is exactly what
        `validate` checked: trimmed, blanks dropped, de-duplicated. A client may send the list as
        the newline-separated text the admin screen edits, since that is what the field there is.
      */
      const raw = Array.isArray(body.ipAllowList)
        ? body.ipAllowList
        : String(body.ipAllowList).split(/[\n,]/)
      patch.ipAllowList = [...new Set(raw.map((entry: unknown) => String(entry).trim()))].filter(
        Boolean
      )
    }
    return patch
  }

  /** @returns The reason the patch cannot be saved, or null when it is fine */
  validate(patch: Partial<ScimConfig>): string | null {
    if (
      patch.deleteAction !== undefined &&
      !SCIM_DELETE_ACTIONS.includes(patch.deleteAction as ScimDeleteAction)
    ) {
      return `The delete action must be one of: ${SCIM_DELETE_ACTIONS.join(', ')}.`
    }
    if (
      patch.emailSource !== undefined &&
      !SCIM_EMAIL_SOURCES.includes(patch.emailSource as ScimEmailSource)
    ) {
      return `The email source must be one of: ${SCIM_EMAIL_SOURCES.join(', ')}.`
    }
    if (
      patch.rateLimitMax !== undefined &&
      (!Number.isFinite(patch.rateLimitMax) || patch.rateLimitMax < 1)
    ) {
      return 'The rate limit must allow at least one request.'
    }
    for (const field of ['rateLimitWindow', 'rateLimitBan'] as const) {
      const value = patch[field]
      /*
        Checked here rather than left to `durationToSeconds`'s fallback, which is a backstop for a
        value that got into the database some other way. A typo saved from the admin screen has to
        come back as an error: silently applying a different limit than the one on screen is the
        failure this setting can least afford.
      */
      if (value !== undefined && durationToSeconds(value, 0) < 1) {
        return `'${value}' is not a duration. Write it as a number and a unit, e.g. 30s, 5m or 1h.`
      }
    }
    if (patch.ipAllowList !== undefined) {
      const bad = patch.ipAllowList.find((entry) => !parseIpRange(entry))
      if (bad) {
        return `'${bad}' is not an IP address or CIDR range, e.g. 203.0.113.4 or 203.0.113.0/24.`
      }
    }
    return null
  }

  async updateConfig(patch: Partial<ScimConfig>): Promise<boolean> {
    const previousConfig = WIKI.config.scim
    WIKI.config.scim = { ...previousConfig, ...patch }

    if (!(await WIKI.configSvc.saveToDb(['scim']))) {
      WIKI.config.scim = previousConfig
      return false
    }
    return true
  }

  /** How many users and groups a directory currently owns, for the admin screen. */
  async getStats(): Promise<{
    users: number
    groups: number
    lastRequest: ScimLastRequest | null
  }> {
    const [users, groups] = await Promise.all([
      WIKI.db.$count(usersTable, eq(usersTable.isProvisioned, true)),
      WIKI.db.$count(groupsTable, eq(groupsTable.isProvisioned, true))
    ])
    return { users, groups, lastRequest }
  }

  recordRequest(entry: Omit<ScimLastRequest, 'at'>): void {
    lastRequest = { at: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }), ...entry }
  }

  // ==========================================
  // MAPPING
  // ==========================================

  /**
   * One user, as SCIM describes them.
   *
   * `groups` is read-only per RFC 7643 §4.1.2 — membership is written through the Group resource,
   * never here — and is included because connectors display it and some reconcile against it.
   */
  toScimUser(
    user: Record<string, any>,
    memberships: Array<{ id: string; name: string }>,
    baseUrl: string
  ): ScimResource {
    const meta = (user.meta ?? {}) as Record<string, any>
    const prefs = (user.prefs ?? {}) as Record<string, any>
    return {
      schemas: [SCHEMA_USER],
      id: user.id,
      ...(user.externalId ? { externalId: user.externalId } : {}),
      userName: user.email,
      name: { formatted: user.name },
      displayName: user.name,
      active: user.isActive,
      emails: [{ value: user.email, type: 'work', primary: true }],
      ...(meta.jobTitle ? { title: meta.jobTitle } : {}),
      ...(prefs.timezone ? { timezone: prefs.timezone } : {}),
      groups: memberships.map((grp) => ({
        value: grp.id,
        display: grp.name,
        $ref: `${baseUrl}/Groups/${grp.id}`,
        type: 'direct'
      })),
      meta: {
        resourceType: 'User',
        created: instantOf(user.createdAt),
        lastModified: instantOf(user.updatedAt),
        location: `${baseUrl}/Users/${user.id}`
      }
    }
  }

  toScimGroup(
    group: Record<string, any>,
    members: Array<{ id: string; name: string }>,
    baseUrl: string
  ): ScimResource {
    return {
      schemas: [SCHEMA_GROUP],
      id: group.id,
      ...(group.externalId ? { externalId: group.externalId } : {}),
      displayName: group.name,
      members: members.map((user) => ({
        value: user.id,
        display: user.name,
        $ref: `${baseUrl}/Users/${user.id}`,
        type: 'User'
      })),
      meta: {
        resourceType: 'Group',
        created: instantOf(group.createdAt),
        lastModified: instantOf(group.updatedAt),
        location: `${baseUrl}/Groups/${group.id}`
      }
    }
  }

  /** The envelope every listing goes out in (RFC 7644 §3.4.2). */
  listResponse(resources: ScimResource[], total: number, startIndex: number): ScimResource {
    return {
      schemas: [SCHEMA_LIST],
      totalResults: total,
      itemsPerPage: resources.length,
      startIndex,
      Resources: resources
    }
  }

  // ==========================================
  // QUERY PARAMETERS
  // ==========================================

  /**
   * `startIndex` and `count`, clamped.
   *
   * `startIndex` is 1-based and a value below 1 is read as 1, which RFC 7644 §3.4.2.4 asks for
   * explicitly. `count` of 0 is legal and means "tell me the total and send no resources" — which is
   * how several connectors size a sync before running it, so it must not be read as "unset".
   */
  parsePaging(query: Record<string, any>): { startIndex: number; count: number } {
    const rawIndex = Number.parseInt(query.startIndex, 10)
    const rawCount = Number.parseInt(query.count, 10)
    return {
      startIndex: Number.isFinite(rawIndex) && rawIndex > 1 ? rawIndex : 1,
      count: Number.isFinite(rawCount)
        ? Math.min(Math.max(rawCount, 0), SCIM_MAX_RESULTS)
        : SCIM_DEFAULT_COUNT
    }
  }

  /**
   * The one filter form this endpoint understands: `<attribute> eq "<value>"`.
   *
   * RFC 7644 §3.4.2.2 defines a whole expression grammar, and connectors use about five corners of
   * it. Rather than build an engine for attributes this wiki does not have, the accepted shape is
   * one equality against a named attribute, and everything else is refused with `invalidFilter` —
   * which is a documented answer a client can act on, unlike a filter silently matching nothing.
   *
   * Value-path segments are stripped before matching, so `emails[type eq "work"].value` is read as
   * `emails.value`. A wiki user has exactly one address, so there is no `type` to distinguish.
   *
   * @param attrs Which attribute names this resource accepts, mapped to what to match on
   * @returns The attribute and the value, or null when no filter was given
   */
  parseFilter(
    raw: string | undefined,
    attrs: Record<string, string>
  ): { attr: string; value: string } | null {
    if (!raw || raw.trim().length < 1) {
      return null
    }
    const flattened = raw.replaceAll(/\[[^\]]*\]/g, '')
    const match = /^\s*([\w.$-]+)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i.exec(flattened)
    if (!match) {
      throw new ScimError(
        400,
        `Only filters of the form '<attribute> eq "<value>"' are supported. Received: ${raw}`,
        'invalidFilter'
      )
    }
    const attr = attrs[match[1]!.toLowerCase()]
    if (!attr) {
      throw new ScimError(
        400,
        `Filtering on '${match[1]}' is not supported. Supported attributes: ${Object.keys(attrs).join(', ')}.`,
        'invalidFilter'
      )
    }
    return { attr, value: match[2]!.replaceAll('\\"', '"').replaceAll('\\\\', '\\') }
  }

  // ==========================================
  // PATCH
  // ==========================================

  /**
   * Fold a PatchOp body into a partial SCIM resource, so that PATCH and PUT converge on one mapping.
   *
   * Rather than interpret each operation against the database, every supported operation is
   * rewritten as the fragment of a resource it is asking for — `{op: 'replace', path: 'active',
   * value: false}` becomes `{active: false}` — and that fragment goes through the same
   * `userValuesFrom` a PUT does. One mapping, one set of rules about what an attribute means.
   *
   * `members` is the exception and cannot be folded this way, because `add` and `remove` are
   * relative to what is already there; `parseGroupPatch` handles it separately.
   *
   * Case is not significant in `op`: the RFC says lowercase and connectors send `Add` and `Replace`.
   */
  parsePatchOps(body: Record<string, any>): Array<{ op: string; path?: string; value?: any }> {
    const operations = body?.Operations ?? body?.operations
    if (!Array.isArray(operations) || operations.length < 1) {
      throw new ScimError(
        400,
        'A PATCH request must carry a non-empty Operations array.',
        'invalidValue'
      )
    }
    return operations.map((entry: any) => {
      const op = String(entry?.op ?? '').toLowerCase()
      if (!['add', 'replace', 'remove'].includes(op)) {
        throw new ScimError(400, `Unsupported PATCH operation '${entry?.op}'.`, 'invalidSyntax')
      }
      return {
        op,
        path: typeof entry?.path === 'string' ? entry.path : undefined,
        value: entry?.value
      }
    })
  }

  /**
   * The user attributes a PATCH may set, as paths mapped onto where they land in the fragment.
   *
   * Everything else is refused. The list is what connectors actually send, and a path this wiki has
   * nowhere to put is better answered with `invalidPath` than accepted and dropped.
   */
  private setUserFragment(fragment: ScimResource, path: string, value: any): void {
    const key = path
      .replaceAll(/\[[^\]]*\]/g, '')
      .trim()
      .toLowerCase()
    switch (key) {
      case 'active':
        fragment.active = value
        break
      case 'username':
        fragment.userName = value
        break
      case 'externalid':
        fragment.externalId = value
        break
      case 'displayname':
        fragment.displayName = value
        break
      case 'title':
        fragment.title = value
        break
      case 'timezone':
        fragment.timezone = value
        break
      case 'name.formatted':
        fragment.name = { ...fragment.name, formatted: value }
        break
      case 'name.givenname':
        fragment.name = { ...fragment.name, givenName: value }
        break
      case 'name.familyname':
        fragment.name = { ...fragment.name, familyName: value }
        break
      case 'emails':
      case 'emails.value':
        fragment.emails = Array.isArray(value) ? value : [{ value, primary: true }]
        break
      case 'name':
        fragment.name = { ...fragment.name, ...value }
        break
      default:
        throw new ScimError(400, `The path '${path}' cannot be patched on a User.`, 'invalidPath')
    }
  }

  /** Fold a user PatchOp body into the partial resource it is asking for. */
  parseUserPatch(body: Record<string, any>): ScimResource {
    const fragment: ScimResource = {}
    for (const { op, path, value } of this.parsePatchOps(body)) {
      if (op === 'remove') {
        /*
          Removing an attribute the wiki stores as a plain column has no meaning — there is no
          "unset" state for a name or an address — with the single exception of `externalId`, which
          is nullable and is how a directory releases an account it no longer tracks.
        */
        if (path && path.trim().toLowerCase() === 'externalid') {
          fragment.externalId = null
          continue
        }
        throw new ScimError(
          400,
          `A User attribute cannot be removed ('${path ?? 'no path'}').`,
          'invalidPath'
        )
      }
      if (!path) {
        // -> The no-path form: the value IS the fragment. What Entra sends for `active`.
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new ScimError(
            400,
            'A PATCH operation without a path must carry an object value.',
            'invalidValue'
          )
        }
        for (const [key, entry] of Object.entries(value)) {
          this.setUserFragment(fragment, key, entry)
        }
        continue
      }
      this.setUserFragment(fragment, path, value)
    }
    return fragment
  }

  /**
   * Fold a group PatchOp body into a rename, an external id, and what to do about the membership.
   *
   * `replace` of the whole `members` attribute sets the membership outright; `add` and `remove` are
   * relative to it. A `remove` naming no value at all empties the group, which is what
   * `{op: 'remove', path: 'members'}` means.
   */
  parseGroupPatch(body: Record<string, any>): {
    displayName?: string
    externalId?: string | null
    replaceMembers?: string[]
    addMembers: string[]
    removeMembers: string[]
    removeAllMembers: boolean
  } {
    const result = {
      displayName: undefined as string | undefined,
      externalId: undefined as string | null | undefined,
      replaceMembers: undefined as string[] | undefined,
      addMembers: [] as string[],
      removeMembers: [] as string[],
      removeAllMembers: false
    }

    const memberIdsOf = (value: any): string[] => {
      const entries = Array.isArray(value)
        ? value
        : value === undefined || value === null
          ? []
          : [value]
      return entries.map((entry: any) => {
        const id = typeof entry === 'string' ? entry : entry?.value
        if (typeof id !== 'string' || id.length < 1) {
          throw new ScimError(
            400,
            'Each member must carry a `value` naming a user id.',
            'invalidValue'
          )
        }
        return id
      })
    }

    for (const { op, path, value } of this.parsePatchOps(body)) {
      const rawPath = (path ?? '').trim()
      const key = rawPath.replaceAll(/\[[^\]]*\]/g, '').toLowerCase()

      if (!rawPath) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new ScimError(
            400,
            'A PATCH operation without a path must carry an object value.',
            'invalidValue'
          )
        }
        if (value.displayName !== undefined) {
          result.displayName = String(value.displayName)
        }
        if (value.externalId !== undefined) {
          result.externalId = value.externalId === null ? null : String(value.externalId)
        }
        if (value.members !== undefined) {
          result.replaceMembers = memberIdsOf(value.members)
        }
        continue
      }

      if (key === 'displayname') {
        if (op === 'remove') {
          throw new ScimError(400, 'A group must have a displayName.', 'invalidValue')
        }
        result.displayName = String(value)
        continue
      }
      if (key === 'externalid') {
        result.externalId = op === 'remove' || value === null ? null : String(value)
        continue
      }
      if (key !== 'members') {
        throw new ScimError(400, `The path '${path}' cannot be patched on a Group.`, 'invalidPath')
      }

      if (op === 'remove') {
        /*
          `members[value eq "<id>"]` is the form Okta removes one member with, and it carries the id
          in the path rather than in a value. The value-path is read here rather than by the flatten
          above, which is why the raw path is kept.
        */
        const targeted = /\[\s*value\s+eq\s+"((?:[^"\\]|\\.)*)"\s*\]/i.exec(rawPath)
        if (targeted) {
          result.removeMembers.push(targeted[1]!)
        } else if (value === undefined || value === null) {
          result.removeAllMembers = true
        } else {
          result.removeMembers.push(...memberIdsOf(value))
        }
        continue
      }
      if (op === 'replace') {
        result.replaceMembers = memberIdsOf(value)
        continue
      }
      result.addMembers.push(...memberIdsOf(value))
    }

    return result
  }

  // ==========================================
  // USERS
  // ==========================================

  /** Which attributes `GET /Users?filter=` accepts, and what each one matches on. */
  private readonly userFilterAttrs: Record<string, string> = {
    username: 'email',
    'emails.value': 'email',
    emails: 'email',
    externalid: 'externalId',
    id: 'id'
  }

  /**
   * The wiki users a SCIM client may see: everybody except the guest account.
   *
   * Every user rather than only the provisioned ones, because the first thing a connector does is
   * look for an account it has not created yet — `filter=userName eq "..."` — and a listing that hid
   * those would have it create a duplicate that the unique email index then refuses. Owning an
   * account is what `isProvisioned` records, and it gates destruction rather than visibility.
   */
  async listUsers({
    filter,
    startIndex,
    count: pageSize,
    baseUrl
  }: {
    filter?: string
    startIndex: number
    count: number
    baseUrl: string
  }): Promise<ScimResource> {
    const parsed = this.parseFilter(filter, this.userFilterAttrs)
    const conditions = [eq(usersTable.isSystem, false)]
    if (parsed?.attr === 'email') {
      conditions.push(sql`lower(${usersTable.email}) = lower(${parsed.value})`)
    } else if (parsed?.attr === 'externalId') {
      conditions.push(eq(usersTable.externalId, parsed.value))
    } else if (parsed?.attr === 'id') {
      // -> A malformed uuid would make postgres raise rather than match nothing, which is the honest
      //    answer to "is there a user with this id"
      if (!this.isUuid(parsed.value)) {
        return this.listResponse([], 0, startIndex)
      }
      conditions.push(eq(usersTable.id, parsed.value))
    }
    const where = and(...conditions)

    const totals = await WIKI.db.select({ total: count() }).from(usersTable).where(where)
    const total = totals[0]?.total ?? 0
    if (pageSize < 1) {
      return this.listResponse([], total, startIndex)
    }

    const rows = await WIKI.db
      .select()
      .from(usersTable)
      .where(where)
      // -> By id, not by name: a listing paged through while somebody is renamed must not skip a row
      .orderBy(asc(usersTable.id))
      .limit(pageSize)
      .offset(startIndex - 1)

    const memberships = await this.membershipsOf(rows.map((row: any) => row.id))
    return this.listResponse(
      rows.map((row: any) => this.toScimUser(row, memberships.get(row.id) ?? [], baseUrl)),
      total,
      startIndex
    )
  }

  /** One user by id, or null — including for the guest account, which SCIM never sees. */
  async getUser(id: string): Promise<Record<string, any> | null> {
    if (!this.isUuid(id)) {
      return null
    }
    const rows = await WIKI.db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.isSystem, false)))
      .limit(1)
    return rows[0] ?? null
  }

  /** The groups each of these users belongs to, in one query. */
  async membershipsOf(
    userIds: string[]
  ): Promise<Map<string, Array<{ id: string; name: string }>>> {
    const result = new Map<string, Array<{ id: string; name: string }>>()
    if (userIds.length < 1) {
      return result
    }
    const rows = await WIKI.db
      .select({ userId: userGroups.userId, id: groupsTable.id, name: groupsTable.name })
      .from(userGroups)
      .innerJoin(groupsTable, eq(groupsTable.id, userGroups.groupId))
      .where(inArray(userGroups.userId, userIds))
    for (const row of rows) {
      const existing = result.get(row.userId) ?? []
      existing.push({ id: row.id, name: row.name })
      result.set(row.userId, existing)
    }
    return result
  }

  /**
   * The wiki values a SCIM user resource is asking for.
   *
   * Applied to a fragment as readily as to a whole resource: a key that is absent is a field the
   * request said nothing about, which is what makes PATCH and PUT share this.
   *
   * The name is composed from whatever the resource gave — `displayName`, then `name.formatted`,
   * then the given and family names joined. A PATCH that sends only `name.givenName` therefore sets
   * the whole name to the given name, because there is one name column here and no parts to merge
   * the fragment into. A composition that comes out empty leaves the stored name alone.
   */
  userValuesFrom(resource: ScimResource): { patch: UserPatch; meta: Record<string, any> } {
    const patch: UserPatch = {}
    const meta: Record<string, any> = {}

    const email = this.emailFrom(resource)
    if (email !== undefined) {
      patch.email = email
    }

    const name = this.nameFrom(resource)
    if (name) {
      patch.name = name
    }

    if (resource.active !== undefined) {
      patch.isActive = readBoolean(resource.active)
    }
    if (resource.externalId !== undefined) {
      meta.externalId = resource.externalId === null ? null : String(resource.externalId)
    }
    if (resource.title !== undefined) {
      meta.jobTitle = resource.title === null ? '' : String(resource.title)
    }
    if (resource.timezone !== undefined) {
      meta.timezone = resource.timezone === null ? '' : String(resource.timezone)
    }
    return { patch, meta }
  }

  /**
   * The address a resource is filing this account under, per the site's `emailSource` setting.
   *
   * `userName` is what every connector sends and is right wherever the login name is the mailbox.
   * `emails` reads the primary entry — or the first work entry, or simply the first — for a
   * directory whose user principal name is not an address.
   */
  private emailFrom(resource: ScimResource): string | undefined {
    const source = this.getConfig().emailSource
    let candidate: any
    if (source === 'emails') {
      const entries = Array.isArray(resource.emails) ? resource.emails : []
      const chosen =
        entries.find((entry: any) => entry?.primary) ??
        entries.find((entry: any) => String(entry?.type ?? '').toLowerCase() === 'work') ??
        entries[0]
      candidate = chosen?.value
      // -> Nothing in `emails[]` and a `userName` that is an address: take it rather than refuse a
      //    resource that plainly carries one
      if (candidate === undefined && looksLikeEmail(String(resource.userName ?? ''))) {
        candidate = resource.userName
      }
    } else {
      candidate = resource.userName
    }
    if (candidate === undefined || candidate === null) {
      return undefined
    }
    const value = String(candidate).trim().toLowerCase()
    if (!looksLikeEmail(value)) {
      throw new ScimError(
        400,
        `'${candidate}' is not an email address. This wiki files every account under one, so the ${
          source === 'emails' ? 'primary entry of emails[]' : 'userName attribute'
        } has to carry it.`,
        'invalidValue'
      )
    }
    return value
  }

  /** The single name column, composed from whatever name attributes the resource carried. */
  private nameFrom(resource: ScimResource): string | undefined {
    const candidates = [
      resource.displayName,
      resource.name?.formatted,
      [resource.name?.givenName, resource.name?.familyName].filter(Boolean).join(' ')
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }
    return undefined
  }

  /**
   * Create an account from a SCIM resource.
   *
   * No password: the person authenticates at the provider, and `loginWithProvider` links the account
   * by address on their first sign-in. Verified, because the directory vouching for the address is
   * the whole point of provisioning — an unverified account is refused at login.
   *
   * No welcome email either. Onboarding belongs to whoever runs the directory, and a wiki that mailed
   * everybody the moment a sync ran would mail an entire company at once.
   */
  async createUser(resource: ScimResource): Promise<string> {
    const { patch, meta } = this.userValuesFrom(resource)
    if (!patch.email) {
      throw new ScimError(400, 'userName is required.', 'invalidValue')
    }
    if (await WIKI.models.users.getByEmail(patch.email)) {
      throw new ScimError(409, 'A user with this email address already exists.', 'uniqueness')
    }
    if (meta.externalId && (await this.getUserByExternalId(meta.externalId))) {
      throw new ScimError(409, 'A user with this externalId already exists.', 'uniqueness')
    }

    const id = await WIKI.models.users.createUser({
      name: patch.name || patch.email.split('@')[0]!,
      email: patch.email,
      isVerified: true,
      isProvisioned: true,
      externalId: meta.externalId ?? null
    })

    // -> `createUser` always makes an active account, so a resource arriving disabled is a second
    //    write rather than a parameter. A directory does provision one: a hire who has not started.
    const followUp: UserPatch = {}
    if (patch.isActive === false) {
      followUp.isActive = false
    }
    if (meta.jobTitle !== undefined || meta.timezone !== undefined) {
      Object.assign(followUp, await this.blobPatchFor(id, meta))
    }
    if (Object.keys(followUp).length > 0) {
      await WIKI.models.users.updateUser(id, followUp)
    }
    return id
  }

  /**
   * Apply a resource — whole or fragment — to an existing account, and mark it provisioned.
   *
   * Marking it here is what adopts an account somebody created by hand: a connector finds it with a
   * filter, writes its own version of the record onto it, and from that moment the directory owns it.
   */
  async applyUser(user: Record<string, any>, resource: ScimResource): Promise<void> {
    const { patch, meta } = this.userValuesFrom(resource)

    if (patch.email && patch.email !== user.email.toLowerCase()) {
      const clash = await WIKI.models.users.getByEmail(patch.email)
      if (clash && clash.id !== user.id) {
        throw new ScimError(409, 'A user with this email address already exists.', 'uniqueness')
      }
    }
    if (meta.externalId) {
      const clash = await this.getUserByExternalId(meta.externalId)
      if (clash && clash.id !== user.id) {
        throw new ScimError(409, 'A user with this externalId already exists.', 'uniqueness')
      }
    }

    const values: UserPatch = { ...patch, isProvisioned: true }
    if (meta.externalId !== undefined) {
      values.externalId = meta.externalId
    }
    Object.assign(values, await this.blobPatchFor(user.id, meta))
    await WIKI.models.users.updateUser(user.id, values)

    /*
      A deactivation has to reach the sessions as well as the row. Login refuses an inactive account,
      but a cookie issued before the directory disabled somebody is a session row that nothing
      re-checks — thirty days of access after the person left. This is the single most important line
      in the file.
    */
    if (values.isActive === false) {
      await WIKI.models.sessions.clearSessionsFromUser(user.id)
    }
  }

  /** The `meta` / `prefs` blob fields a resource touched, merged onto what is stored. */
  private async blobPatchFor(userId: string, meta: Record<string, any>): Promise<UserPatch> {
    if (meta.jobTitle === undefined && meta.timezone === undefined) {
      return {}
    }
    const user = await WIKI.models.users.getById(userId)
    const patch: UserPatch = {}
    if (meta.jobTitle !== undefined) {
      patch.meta = { ...((user?.meta ?? {}) as Record<string, any>), jobTitle: meta.jobTitle }
    }
    if (meta.timezone !== undefined) {
      patch.prefs = { ...((user?.prefs ?? {}) as Record<string, any>), timezone: meta.timezone }
    }
    return patch
  }

  async getUserByExternalId(externalId: string): Promise<Record<string, any> | null> {
    const rows = await WIKI.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.externalId, externalId))
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * Deprovision an account the directory owns.
   *
   * `deactivate` — the default — clears the sessions and every group membership but keeps the row,
   * because a wiki's users are its authors: deleting one takes the attribution off every page and
   * every version they wrote. `delete` removes it outright, for an instance that would rather not
   * keep the record.
   *
   * RFC 7644 wants a subsequent GET to answer 404. Under `deactivate` it answers the resource with
   * `active: false` instead, which is a deliberate deviation — and the useful one, since it is what
   * lets the same person be re-enabled later rather than collide with their own address.
   */
  async deprovisionUser(userId: string): Promise<ScimDeleteAction> {
    const action = this.getConfig().deleteAction
    if (action === 'delete') {
      await WIKI.models.users.deleteUser(userId)
      return 'delete'
    }
    await WIKI.models.users.updateUser(userId, { isActive: false })
    await WIKI.db.delete(userGroups).where(eq(userGroups.userId, userId))
    await WIKI.models.sessions.clearSessionsFromUser(userId)
    return 'deactivate'
  }

  // ==========================================
  // GROUPS
  // ==========================================

  private readonly groupFilterAttrs: Record<string, string> = {
    displayname: 'name',
    externalid: 'externalId',
    id: 'id'
  }

  async listGroups({
    filter,
    startIndex,
    count: pageSize,
    baseUrl
  }: {
    filter?: string
    startIndex: number
    count: number
    baseUrl: string
  }): Promise<ScimResource> {
    const parsed = this.parseFilter(filter, this.groupFilterAttrs)
    const conditions = []
    if (parsed?.attr === 'name') {
      conditions.push(sql`lower(${groupsTable.name}) = lower(${parsed.value})`)
    } else if (parsed?.attr === 'externalId') {
      conditions.push(eq(groupsTable.externalId, parsed.value))
    } else if (parsed?.attr === 'id') {
      if (!this.isUuid(parsed.value)) {
        return this.listResponse([], 0, startIndex)
      }
      conditions.push(eq(groupsTable.id, parsed.value))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const totals = await WIKI.db.select({ total: count() }).from(groupsTable).where(where)
    const total = totals[0]?.total ?? 0
    if (pageSize < 1) {
      return this.listResponse([], total, startIndex)
    }

    const rows = await WIKI.db
      .select()
      .from(groupsTable)
      .where(where)
      .orderBy(asc(groupsTable.id))
      .limit(pageSize)
      .offset(startIndex - 1)

    const members = await this.membersOf(rows.map((row: any) => row.id))
    return this.listResponse(
      rows.map((row: any) => this.toScimGroup(row, members.get(row.id) ?? [], baseUrl)),
      total,
      startIndex
    )
  }

  async getGroup(id: string): Promise<Record<string, any> | null> {
    if (!this.isUuid(id)) {
      return null
    }
    const rows = await WIKI.db.select().from(groupsTable).where(eq(groupsTable.id, id)).limit(1)
    return rows[0] ?? null
  }

  /**
   * The members of each of these groups, in one query.
   *
   * The guest account is left out: it is the anonymous visitor rather than a person, SCIM never sees
   * it as a user, and a group listing that named an id no `GET /Users/:id` would answer is a listing
   * a connector cannot reconcile against.
   */
  async membersOf(groupIds: string[]): Promise<Map<string, Array<{ id: string; name: string }>>> {
    const result = new Map<string, Array<{ id: string; name: string }>>()
    if (groupIds.length < 1) {
      return result
    }
    const rows = await WIKI.db
      .select({ groupId: userGroups.groupId, id: usersTable.id, name: usersTable.name })
      .from(userGroups)
      .innerJoin(usersTable, eq(usersTable.id, userGroups.userId))
      .where(and(inArray(userGroups.groupId, groupIds), eq(usersTable.isSystem, false)))
    for (const row of rows) {
      const existing = result.get(row.groupId) ?? []
      existing.push({ id: row.id, name: row.name })
      result.set(row.groupId, existing)
    }
    return result
  }

  async getGroupByExternalId(externalId: string): Promise<Record<string, any> | null> {
    const rows = await WIKI.db
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.externalId, externalId))
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * Create a wiki group from a SCIM resource.
   *
   * It is born holding the same starting permissions any group created in the admin area holds, and
   * nothing more: a group named by a directory is a set of people, not a decision about what they
   * may do. Whoever runs the wiki grants it what it should have.
   */
  async createGroup(resource: ScimResource): Promise<string> {
    if (!this.getConfig().allowGroupCreate) {
      throw new ScimError(
        403,
        'This wiki does not accept groups created by provisioning. Create the group here first, and the directory can then manage its membership.'
      )
    }
    const displayName = String(resource.displayName ?? '').trim()
    if (displayName.length < 1) {
      throw new ScimError(400, 'displayName is required.', 'invalidValue')
    }
    const invalid = await WIKI.models.groups.validateName(displayName)
    if (invalid) {
      throw new ScimError(409, invalid, 'uniqueness')
    }
    const externalId = resource.externalId === undefined ? null : String(resource.externalId)
    if (externalId && (await this.getGroupByExternalId(externalId))) {
      throw new ScimError(409, 'A group with this externalId already exists.', 'uniqueness')
    }

    const id = await WIKI.models.groups.createGroup(displayName)
    await WIKI.models.groups.updateGroup(id, { isProvisioned: true, externalId } as GroupPatch)
    return id
  }

  /** Rename a group and record its external id, leaving its permissions and rules untouched. */
  async applyGroup(
    group: Record<string, any>,
    { displayName, externalId }: { displayName?: string; externalId?: string | null }
  ): Promise<void> {
    const patch: GroupPatch = { isProvisioned: true }
    if (displayName !== undefined && displayName.trim() !== group.name) {
      const trimmed = displayName.trim()
      if (group.isSystem) {
        throw new ScimError(403, `The '${group.name}' group is built in and cannot be renamed.`)
      }
      const invalid = await WIKI.models.groups.validateName(trimmed, group.id)
      if (invalid) {
        throw new ScimError(409, invalid, 'uniqueness')
      }
      patch.name = trimmed
    }
    if (externalId !== undefined) {
      if (externalId) {
        const clash = await this.getGroupByExternalId(externalId)
        if (clash && clash.id !== group.id) {
          throw new ScimError(409, 'A group with this externalId already exists.', 'uniqueness')
        }
      }
      patch.externalId = externalId
    }
    await WIKI.models.groups.updateGroup(group.id, patch)
  }

  /** The ids currently in a group, which `add` and `remove` are relative to. */
  async memberIdsOf(groupId: string): Promise<string[]> {
    const rows = await WIKI.db
      .select({ userId: userGroups.userId })
      .from(userGroups)
      .innerJoin(usersTable, eq(usersTable.id, userGroups.userId))
      .where(and(eq(userGroups.groupId, groupId), eq(usersTable.isSystem, false)))
    return rows.map((row: any) => row.userId)
  }

  /** Whether these ids all name a user SCIM can see. @returns the first id that does not */
  async firstUnknownUser(userIds: string[]): Promise<string | null> {
    const unique = [...new Set(userIds)]
    if (unique.length < 1) {
      return null
    }
    const malformed = unique.find((id) => !this.isUuid(id))
    if (malformed) {
      return malformed
    }
    const rows = await WIKI.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(inArray(usersTable.id, unique), eq(usersTable.isSystem, false)))
    const found = new Set(rows.map((row: any) => row.id))
    return unique.find((id) => !found.has(id)) ?? null
  }

  /** Delete a group the directory owns. Its memberships go with it, by the foreign key's cascade. */
  async deleteGroup(groupId: string): Promise<void> {
    await WIKI.models.groups.deleteGroup(groupId)
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  }
}

export const scim = new Scim()
