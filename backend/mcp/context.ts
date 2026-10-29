import { PASSWORD_BYPASS, SOURCE_PERMISSIONS } from '../api/pages.ts'
import { maySeeUnpublished, maySeeUnpublishedAnywhere } from '../helpers/publishing.ts'
import { grantsScope } from '../models/personalTokens.ts'
import type { FastifyRequest } from 'fastify'
import type { RulePageRef } from '../helpers/pageRules.ts'
import type { RequestUser } from '../helpers/requester.ts'
import type { AccessActor } from '../models/groups.ts'
import type { TokenScope } from '../models/personalTokens.ts'

/**
 * Who a call on `/_mcp` acts as, and on which site.
 *
 * Built from the bearer token and nothing else. `/_mcp` ignores the session cookie — a browser that
 * happens to be signed in to the wiki is not thereby an agent's credential — so nothing a tool asks is
 * routed through the request helpers in `api/pages.ts`, which fall back on the session when there is
 * no key. The questions are the same ones, asked of this actor instead.
 */
export interface McpContext {
  req: FastifyRequest
  /** The site the hostname resolves to. Tools take no site: an agent connected to a host sees that site. */
  siteId: string
  /** `https://host`, which every URL a tool hands back is built on. */
  origin: string
  /** The account the call acts as, or null for an anonymous caller — the guests group. */
  user: RequestUser | null
  /** The groups whose rules decide, and the group-wide permissions held. */
  actor: AccessActor
  /**
   * The token's scopes, or null for an anonymous caller, who is treated as holding `mcp:read` and
   * every category at read and nothing at write.
   */
  scopes: TokenScope[] | null
  /** The personal access token's row id, for the audit trail. Null for an anonymous caller. */
  tokenId: string | null
}

/**
 * The context for a request the controller has already authenticated: `req.apiKey` is a personal
 * access token, or there is none and anonymous access is on.
 */
export function contextFor(req: FastifyRequest, siteId: string, origin: string): McpContext {
  const key = req.apiKey
  if (key?.kind === 'personal' && key.user) {
    return {
      req,
      siteId,
      origin,
      user: key.user,
      actor: { groupIds: key.groupIds, permissions: key.permissions },
      scopes: key.scopes ?? [],
      tokenId: key.id
    }
  }
  return {
    req,
    siteId,
    origin,
    user: null,
    // -> The public, as the sitemap and the public document are built: the guests group's rules and no
    //    group-wide permission, which is what an anonymous request holds everywhere else too
    actor: WIKI.models.groups.actorForPublic(),
    scopes: null,
    tokenId: null
  }
}

/** Whether the caller holds a scope. An anonymous caller holds every `:read` and no `:write`. */
export function holdsScope(ctx: McpContext, scope: TokenScope): boolean {
  if (!ctx.scopes) {
    return scope.endsWith(':read')
  }
  return grantsScope(ctx.scopes, scope)
}

/** `groups.checkAccess` for this caller — the one place a page permission is decided. */
export function mayOnPage(ctx: McpContext, permission: string, page: RulePageRef): boolean {
  return WIKI.models.groups.checkAccess(ctx.actor, permission, page)
}

/** As `mayReadSource` in `api/pages.ts`: `read:source`, or a permission that implies the editor. */
export function mayReadSource(ctx: McpContext, page: RulePageRef): boolean {
  return SOURCE_PERMISSIONS.some((permission) => mayOnPage(ctx, permission, page))
}

/**
 * Whether a page's password is no barrier to this caller. An agent cannot unlock a page — it has no
 * session to record the unlock on, and a password is not something to hand to a model — so this is
 * the only way past one.
 */
export function mayBypassPassword(ctx: McpContext, page: RulePageRef): boolean {
  return PASSWORD_BYPASS.some((permission) => mayOnPage(ctx, permission, page))
}

/**
 * As `unpublishedFor` in `api/pages.ts`: a page that is not live is handed only to an account that
 * may edit it, and never to an anonymous caller.
 */
export function unpublishedFor(ctx: McpContext): false | ((page: RulePageRef) => boolean) {
  if (!ctx.user || !maySeeUnpublishedAnywhere(ctx.actor)) {
    return false
  }
  return (page) => maySeeUnpublished(ctx.actor, page)
}

/** The absolute URL of a page, as the canonical link names it. */
export function pageUrl(ctx: McpContext, locale: string, path: string): string {
  return `${ctx.origin}${encodeURI(WIKI.models.pages.urlFor(ctx.siteId, locale, path))}`
}
