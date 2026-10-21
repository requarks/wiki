import { isValidPathSegment, normalizePagePath } from '../helpers/common.ts'
import { TokenBucketLimiter } from '../helpers/tokenBucket.ts'
import type { TokenBucketVerdict } from '../helpers/tokenBucket.ts'

/**
 * The groups tools come in, each one switch on Admin → MCP.
 *
 * A group is the administrator's lever: one that is off is listed to nobody, whatever a token's
 * scopes say. The token's scopes are the owner's lever, and the two do not line up one to one —
 * `pages:write` reaches `edit` and `destructive` alike, which is why moving and deleting pages are a
 * group of their own. See `dev/specs/mcp.md` §5.
 */
export const MCP_TOOL_GROUPS = [
  'discover',
  'pages',
  'history',
  'glossary',
  'comments',
  'suggest',
  'edit',
  'assets',
  'destructive'
] as const
export type McpToolGroup = (typeof MCP_TOOL_GROUPS)[number]

export const MCP_PUBLISH_STATES = ['published', 'draft'] as const
export type McpPublishState = (typeof MCP_PUBLISH_STATES)[number]

/** The `mcp` settings blob, as the admin area reads and writes it. */
export interface McpConfig {
  isEnabled: boolean
  allowAnonymous: boolean
  tools: Record<McpToolGroup, boolean>
  newPagePublishState: McpPublishState
  maxResultChars: number
  rateLimitBurst: number
  rateLimitPerMinute: number
  showAiBadge: boolean
}

/** The bounds an administrator may set the numeric settings within. */
export const MCP_LIMITS = {
  maxResultChars: { min: 1000, max: 1000000 },
  rateLimitBurst: { min: 1, max: 10000 },
  rateLimitPerMinute: { min: 1, max: 100000 }
} as const

/**
 * MCP model
 *
 * The settings of the Model Context Protocol server at `/_mcp` — `controllers/mcp.ts` is the endpoint,
 * `mcp/` the protocol and the tools. One instance-wide blob, as SCIM's is: a token belongs to a user
 * and users are per instance, and which sites an agent sees is decided by page rules like everything
 * else it sees.
 *
 * Everything is read per request through `WIKI.config`, so a saved change applies on the next call
 * and on every instance. `base.yml` holds the defaults, merged under the stored blob on every boot, so
 * a field added later reads its default on an installation that saved the blob before it existed.
 */
class Mcp {
  /** Per owner, or per address for an anonymous caller. See `helpers/tokenBucket.ts`. */
  #limiter = new TokenBucketLimiter()

  getConfig(): McpConfig {
    const mcp = WIKI.config.mcp
    return {
      isEnabled: mcp.isEnabled === true,
      allowAnonymous: mcp.allowAnonymous === true,
      tools: Object.fromEntries(
        MCP_TOOL_GROUPS.map((group) => [group, mcp.tools?.[group] === true])
      ) as Record<McpToolGroup, boolean>,
      newPagePublishState: mcp.newPagePublishState,
      maxResultChars: mcp.maxResultChars,
      rateLimitBurst: mcp.rateLimitBurst,
      rateLimitPerMinute: mcp.rateLimitPerMinute,
      showAiBadge: mcp.showAiBadge === true
    }
  }

  /** Whether the endpoint is turned on. Read per request, so a change applies at once. */
  isEnabled(): boolean {
    return WIKI.config.mcp?.isEnabled === true
  }

  isGroupEnabled(group: McpToolGroup): boolean {
    return WIKI.config.mcp?.tools?.[group] === true
  }

  /**
   * Spend one call of this caller's budget.
   *
   * @param key Who is calling: `user:<id>` for a token's owner — so that a second token does not buy a
   *            second budget — or `ip:<address>` for an anonymous caller
   */
  consume(key: string): TokenBucketVerdict {
    const { rateLimitBurst, rateLimitPerMinute } = this.getConfig()
    return this.#limiter.take(key, { burst: rateLimitBurst, perMinute: rateLimitPerMinute })
  }

  /** Keep only the fields this model owns, dropping anything else a client sends. */
  pickFields(body: Record<string, any>): Partial<McpConfig> {
    const patch: Partial<McpConfig> = {}
    for (const field of ['isEnabled', 'allowAnonymous', 'showAiBadge'] as const) {
      if (body[field] !== undefined) {
        patch[field] = Boolean(body[field])
      }
    }
    if (body.tools !== undefined && body.tools && typeof body.tools === 'object') {
      // -> Merged over what is stored, so a client may send only the groups it is changing
      const tools = { ...this.getConfig().tools }
      for (const group of MCP_TOOL_GROUPS) {
        if (body.tools[group] !== undefined) {
          tools[group] = Boolean(body.tools[group])
        }
      }
      patch.tools = tools
    }
    if (body.newPagePublishState !== undefined) {
      patch.newPagePublishState = body.newPagePublishState
    }
    for (const field of Object.keys(MCP_LIMITS) as (keyof typeof MCP_LIMITS)[]) {
      if (body[field] !== undefined) {
        patch[field] = Number(body[field])
      }
    }
    return patch
  }

  /** @returns The reason the patch cannot be saved, or null when it is fine */
  validate(patch: Partial<McpConfig>): string | null {
    if (
      patch.newPagePublishState !== undefined &&
      !MCP_PUBLISH_STATES.includes(patch.newPagePublishState)
    ) {
      return `The publish state of new pages must be one of: ${MCP_PUBLISH_STATES.join(', ')}.`
    }
    for (const [field, { min, max }] of Object.entries(MCP_LIMITS)) {
      const value = patch[field as keyof typeof MCP_LIMITS]
      if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) {
        return `${field} must be a whole number between ${min} and ${max}.`
      }
    }
    return null
  }

  /**
   * The path of a site's agent guidelines page, in its primary locale, or an empty string for none.
   *
   * The one MCP setting a site has of its own, since it names a page in that site's tree. Its text is
   * handed to an assistant in the server instructions — see `mcp/protocol.ts`.
   */
  guidelinesPathFor(siteId: string): string {
    return WIKI.sites[siteId]?.config?.mcp?.guidelinesPath ?? ''
  }

  /**
   * Set a site's guidelines page.
   *
   * A path, not a page: the page need not exist yet, so that an administrator can name it and then
   * write it — the admin screen offers to. Normalized as a lookup is (`normalizePagePath`), since
   * this names a page to find rather than one to create.
   *
   * @returns The reason the path cannot be saved, or null once it has been
   */
  async setGuidelinesPath(siteId: string, input: string): Promise<string | null> {
    const path = normalizePagePath(input)
    if (path && !path.split('/').every((segment) => isValidPathSegment(segment))) {
      return 'That is not a page path.'
    }
    const saved = await WIKI.models.sites.updateSite(siteId, {
      config: { mcp: { guidelinesPath: path } }
    })
    return saved ? null : 'Failed to save the guidelines page.'
  }

  async updateConfig(patch: Partial<McpConfig>): Promise<boolean> {
    const previousConfig = WIKI.config.mcp
    WIKI.config.mcp = { ...previousConfig, ...patch }

    if (!(await WIKI.configSvc.saveToDb(['mcp']))) {
      WIKI.config.mcp = previousConfig
      return false
    }
    return true
  }
}

export const mcp = new Mcp()
