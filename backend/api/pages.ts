import { validate as uuidValidate } from 'uuid'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PageActor, PageInput } from '../models/pages.ts'
import { SEARCH_ORDER_BY, type SearchOrderBy } from '../models/search.ts'
import { generatePathHash } from '../helpers/common.ts'
import { limitAuthAttempts } from '../helpers/rateLimit.ts'

/** Comma-separated query lists, which is how the browser sends a multi-valued filter here. */
function splitList(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map((v) => v.trim())
      .filter(Boolean) ?? []
  )
}

const siteIdParam = {
  type: 'object',
  properties: {
    siteId: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['siteId']
}

const pageIdParam = {
  type: 'object',
  properties: {
    siteId: {
      type: 'string',
      format: 'uuid'
    },
    pageId: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['siteId', 'pageId']
}

/**
 * Who is saving, and what they may embed.
 *
 * A page records an author, so it takes a logged in user rather than an API key — and the author's
 * permissions are what the render is sanitized against.
 */
export function actorFrom(req: FastifyRequest): PageActor | null {
  if (!req.session?.authenticated || !req.session.user?.id) {
    return null
  }
  return {
    id: req.session.user.id,
    permissions: req.session.permissions ?? []
  }
}

/**
 * Permissions that make a page's password irrelevant to the holder.
 *
 * Whoever may edit a page can read its source in the editor and can take the password off it
 * altogether, so asking them for it protects nothing. Everybody else — including a logged in reader —
 * has to enter it.
 *
 * Site-wide rather than per page, because per-path rules are not implemented. See the FIXME on the
 * page-permissions route below.
 */
const PASSWORD_BYPASS = ['write:pages', 'manage:pages', 'manage:system']

/**
 * Every page permission a rule can grant, i.e. the whole set `manage:system` amounts to. Mirrors the
 * page rules offered in the group editor, and is what the interface asks about per path.
 */
const PAGE_PERMISSIONS = [
  'read:pages',
  'write:pages',
  'review:pages',
  'manage:pages',
  'delete:pages',
  'write:styles',
  'write:scripts',
  'read:source',
  'read:history',
  'read:assets',
  'write:assets',
  'manage:assets',
  'read:comments',
  'write:comments',
  'manage:comments'
]

export function mayBypassPassword(req: FastifyRequest): boolean {
  const permissions = req.apiKey?.permissions ?? req.session?.permissions ?? []
  return PASSWORD_BYPASS.some((permission) => permissions.includes(permission))
}

/**
 * Whether the password on a page has already been satisfied for this request.
 *
 * The unlock is recorded on the session — server side, by page id — so that reading a page the reader
 * unlocked a moment ago does not ask again, and so that nothing the browser can set decides this.
 */
export function unlockedFor(req: FastifyRequest, pageId: string): boolean {
  return mayBypassPassword(req) || Boolean(req.session?.unlockedPages?.includes(pageId))
}

/**
 * Whether this requester holds a page permission ON THIS PAGE.
 *
 * Page permissions are granted by a group's rules, not by the group-wide permission list, so this is
 * a different question from the one the route-level `config.permissions` hook answers — and the only
 * correct one for anything page-scoped. `helpers/pageRules.ts` sets out how a rule is chosen.
 */
export function mayOnPage(
  req: FastifyRequest,
  permission: string,
  page: { path: string; locale?: string; tags?: string[] }
): boolean {
  return WIKI.models.groups.checkAccess(WIKI.models.groups.actorForRequest(req), permission, page)
}

/**
 * Every page permission this requester holds at a path.
 *
 * What the interface hides its controls by, and the reason it is a list rather than a question: each
 * permission may be decided by a different rule — a branch can be readable but not writable, and one
 * page within it neither — so they are resolved one at a time.
 *
 * Anonymous included: the guests group has rules of its own, and what the public may do is exactly
 * what they say. Answering an empty list for a reader without a session would hide controls a wiki had
 * deliberately opened to everyone.
 */
export function pagePermissionsFor(
  req: FastifyRequest,
  page: { path: string; locale?: string; tags?: string[] }
): string[] {
  const actor = WIKI.models.groups.actorForRequest(req)
  /*
    An administrator holds all of them, and holds them here too. Deriving the list from their
    permissions instead would answer `manage:system` → nothing ending in `:pages` → that an
    administrator has no rights over any page, which is the opposite of true.
  */
  if (actor.permissions.includes('manage:system')) {
    return PAGE_PERMISSIONS
  }
  return PAGE_PERMISSIONS.filter((permission) =>
    WIKI.models.groups.checkAccess(actor, permission, page)
  )
}

/**
 * A page, as this requester is allowed to see it — or null when they are not allowed to see it at all.
 *
 * The gate for anything that hangs off a page but is not the page itself. An anonymous requester only
 * ever reaches a published page, and a password-protected one comes back with `isLocked` set until the
 * session has satisfied the unlock, which the caller is expected to refuse on.
 */
async function loadReadablePage(req: FastifyRequest, siteId: string, pageId: string) {
  const actor = actorFrom(req)
  const page = await WIKI.models.pages.getPage({
    siteId,
    id: pageId,
    publicOnly: !actor,
    unlocked: (id: string) => unlockedFor(req, id)
  })
  // -> Not readable is indistinguishable from not there, for anything hanging off the page
  if (!page || !mayOnPage(req, 'read:pages', page)) {
    return null
  }
  return page
}

/**
 * Pages API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST PAGES
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/pages',
    {
      /*
        No route-level `permissions`: page permissions come from a group's RULES, and this would have
        to filter per page against them. It has nothing to filter yet — see the description.
      */
      schema: {
        summary: 'List all pages',
        description:
          'Not implemented yet — always answers with an empty list. Browse the tree instead, which is what the file manager and the navigation use, and which filters what it lists by the page rules.',
        tags: ['Pages'],
        params: siteIdParam,
        response: {
          200: {
            description: 'List of pages',
            type: 'array',
            items: { $ref: 'Page#' }
          }
        }
      }
    },
    async () => {
      return []
    }
  )

  /**
   * SEARCH PAGES
   */
  app.get<{
    Params: { siteId: string }
    Querystring: {
      query?: string
      path?: string
      locales?: string
      tags?: string
      editor?: string
      publishState?: string
      orderBy?: SearchOrderBy
      orderByDirection?: 'asc' | 'desc'
      offset?: number
      limit?: number
    }
  }>(
    '/sites/:siteId/pages/search',
    {
      schema: {
        summary: 'Search pages',
        description:
          'Postgres full-text search over the pages of a site, ranked by relevance. `query` may be left out, in which case the filters alone decide the results — which is what a search for nothing but tags is.\n\nReadable without a session, for the same reason reading a page is: an anonymous request only matches published pages. Drafts are included only for someone who may write pages. A page marked as not searchable never appears, whoever is asking.\n\nA password-protected page is listed like any other — its title and description are not what the password covers — but for a searcher who would have to enter that password it can only be matched on those two, never on the text behind the lock, and it comes back with no `highlight`.\n\n`highlight` is an excerpt with the matched terms wrapped in `<b>`, and is the only field carrying markup — the excerpt is escaped before those are added. It is absent unless term highlighting is enabled in the search settings.',
        tags: ['Pages'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              maxLength: 2048,
              description: 'Free text. Understands quoted phrases, `or` and `-exclusions`.'
            },
            path: {
              type: 'string',
              maxLength: 2048,
              description: 'Only pages whose path starts with this.'
            },
            locales: {
              type: 'string',
              maxLength: 255,
              description: 'Comma-separated locale codes. Every locale when absent.'
            },
            tags: {
              type: 'string',
              maxLength: 2048,
              description: 'Comma-separated tags a page must carry all of.'
            },
            editor: {
              type: 'string',
              maxLength: 255
            },
            publishState: {
              type: 'string',
              enum: ['draft', 'published', 'scheduled']
            },
            orderBy: {
              type: 'string',
              enum: SEARCH_ORDER_BY,
              default: 'relevancy'
            },
            orderByDirection: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc'
            },
            offset: {
              type: 'integer',
              minimum: 0,
              default: 0
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 25
            }
          }
        },
        response: {
          200: {
            description: 'Matching pages, plus how many there are in total',
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    path: { type: 'string' },
                    locale: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    icon: { type: ['string', 'null'] },
                    tags: { type: 'array', items: { type: 'string' } },
                    updatedAt: { type: 'string', format: 'date-time' },
                    relevancy: { type: 'number' },
                    highlight: {
                      type: ['string', 'null'],
                      description: 'Excerpt with matched terms in `<b>`, everything else escaped.'
                    }
                  }
                }
              },
              totalHits: {
                type: 'integer',
                description: 'How many pages match, ignoring `limit` and `offset`.'
              }
            }
          }
        }
      }
    },
    async (req) => {
      const actor = actorFrom(req)
      const permissions = actor?.permissions ?? []
      return WIKI.models.search.searchPages({
        siteId: req.params.siteId,
        query: req.query.query,
        path: req.query.path,
        locales: splitList(req.query.locales),
        tags: splitList(req.query.tags),
        editor: req.query.editor,
        publishState: req.query.publishState,
        orderBy: req.query.orderBy,
        orderByDirection: req.query.orderByDirection,
        offset: req.query.offset,
        limit: req.query.limit,
        publicOnly: !actor,
        // -> So that a page the caller could not open never shows up as a result
        actor: WIKI.models.groups.actorForRequest(req),
        // -> An unpublished page is only of interest to someone who could have written it
        includeDrafts: ['write:pages', 'manage:pages', 'manage:system'].some((p) =>
          permissions.includes(p)
        ),
        // -> Same rule as the page view: a protected page's text is for whoever holds the password, and
        //    a search excerpt is that text. Its title and description are not covered, so the page is
        //    still listed — see `hideProtectedContent`.
        hideProtectedContent: !mayBypassPassword(req)
      })
    }
  )

  /**
   * GET PAGE FOR INCLUSION
   */
  app.get<{ Params: { siteId: string }; Querystring: { path: string; locale?: string } }>(
    '/sites/:siteId/pages/include',
    {
      schema: {
        summary: 'Get a page for inclusion',
        description:
          "What an include block needs to draw another page inside the one being read: its title and its stored render, addressed by path rather than by ID, since a path is what an author writes into the page.\n\nThe reader's own access decides the answer, exactly as it would if they opened the page themselves — an anonymous request only ever sees published pages, and a password-protected page comes back with `isLocked: true` and no body unless this session has already unlocked it. So an include can never show content its reader could not have reached on their own.",
        tags: ['Pages'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              maxLength: 2048,
              description: 'Slash-separated path of the page to include. The home page when empty.'
            },
            locale: {
              type: 'string',
              maxLength: 10,
              description: "The site's primary locale when absent."
            }
          }
        },
        response: {
          200: { $ref: 'IncludedPage#' }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      // -> The stored path: no wrapping slashes, lowercase, and the site root is the `home` page
      const path = req.query.path.trim().replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
      const page = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        hash: generatePathHash(path || 'home'),
        locale: req.query.locale,
        publicOnly: !actor,
        unlocked: (pageId) => unlockedFor(req, pageId),
        withPassword: false
      })
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'read:pages', page)) {
        return reply.forbidden('You are not allowed to read this page.')
      }
      return {
        path: page.path,
        locale: page.locale,
        title: page.title,
        isLocked: page.isLocked,
        render: page.render
      }
    }
  )

  /**
   * GET PAGE
   */
  app.get<{
    Params: { siteId: string; pageIdOrHash: string }
    Querystring: { withContent?: boolean; locale?: string }
  }>(
    '/sites/:siteId/pages/:pageIdOrHash',
    {
      schema: {
        summary: 'Get a single page',
        description:
          "Addressed either by ID or by the hash of its path, which is how a page view asks for one. A hash only identifies a page within a locale, so `locale` picks between translations — the site's primary one when absent.\n\nReadable without a session, because a wiki is read by people who are not logged in — but an anonymous request only ever sees published pages, and never their source. Per-page access rules are not implemented yet.\n\nA password-protected page answers with its metadata and `isLocked: true`, its body withheld, until the session satisfies `POST …/unlock` — or unless the requester may edit the page, for whom the password is not a barrier.",
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            pageIdOrHash: {
              type: 'string',
              oneOf: [{ format: 'uuid' }, { pattern: '^[a-f0-9]+$' }]
            }
          },
          required: ['siteId', 'pageIdOrHash']
        },
        querystring: {
          type: 'object',
          properties: {
            withContent: {
              type: 'boolean',
              default: false,
              description: 'Include the source, which only an editor needs.'
            },
            locale: {
              type: 'string',
              maxLength: 10
            }
          }
        },
        response: {
          200: { $ref: 'Page#' }
        }
      }
    },
    async (req, reply) => {
      const isId = uuidValidate(req.params.pageIdOrHash)
      const actor = actorFrom(req)
      const page = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        ...(isId ? { id: req.params.pageIdOrHash } : { hash: req.params.pageIdOrHash }),
        locale: req.query.locale,
        // -> The source is what an editor loads, and editing is not something an anonymous reader does
        withContent: Boolean(req.query.withContent) && Boolean(actor),
        publicOnly: !actor,
        // -> Answered once the page is known, since a hash does not say which page it is yet
        unlocked: (pageId) => unlockedFor(req, pageId),
        withPassword: mayBypassPassword(req)
      })
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'read:pages', page)) {
        return reply.forbidden('You are not allowed to read this page.')
      }
      /*
        The reader's own standing on this page, carried back with it.

        Three questions the page view used to ask as three more requests — what may I do here, may I
        suggest an edit, do I review this page — each of which had to load the page again to answer.
        They are answered here from the page already in hand, against rules already in memory, which
        is what makes a page view one request instead of four.
      */
      const actorId = actor?.id ?? null
      const [approvalState, isWatching] = await Promise.all([
        WIKI.models.approvals.pageViewerState(req, req.params.siteId, {
          id: page.id,
          path: page.path,
          tags: page.tags ?? [],
          allowContributions: page.allowContributions
        }),
        // -> One indexed lookup on (pageId, userId), and none at all for a reader with no account
        WIKI.models.pageWatching.isWatching(page.id, actorId)
      ])
      return {
        ...page,
        viewer: {
          permissions: pagePermissionsFor(req, page),
          ...approvalState,
          isWatching
        }
      }
    }
  )

  /**
   * UNLOCK PAGE
   */
  app.post<{
    Params: { siteId: string; pageIdOrHash: string }
    Querystring: { locale?: string }
    Body: { password: string }
  }>(
    '/sites/:siteId/pages/:pageIdOrHash/unlock',
    {
      // -> A password endpoint like the ones in `api/authentication.ts`, and limited with them
      onRequest: limitAuthAttempts,
      schema: {
        summary: 'Unlock a password-protected page',
        description:
          'Answers with the page, body included, when the password matches — and records the unlock on the session, so that reading the page again does not ask a second time. A wrong password is a 401 and says nothing more; a page with no password on it answers the same way, so that this cannot be used to find out which pages are protected.\n\nCallable without a session, because a protected page is written for readers who have the password rather than an account. Unlocking one is what first gives an anonymous reader a session.\n\nWhoever may edit the page never needs this: they can read the source and remove the password, so `GET` already hands them the body.',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            pageIdOrHash: {
              type: 'string',
              oneOf: [{ format: 'uuid' }, { pattern: '^[a-f0-9]+$' }]
            }
          },
          required: ['siteId', 'pageIdOrHash']
        },
        querystring: {
          type: 'object',
          properties: {
            locale: {
              type: 'string',
              maxLength: 10
            }
          }
        },
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            password: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          }
        },
        response: {
          200: { $ref: 'Page#' }
        }
      }
    },
    async (req, reply) => {
      const isId = uuidValidate(req.params.pageIdOrHash)
      const actor = actorFrom(req)
      const page = await WIKI.models.pages.unlockPage({
        siteId: req.params.siteId,
        ...(isId ? { id: req.params.pageIdOrHash } : { hash: req.params.pageIdOrHash }),
        locale: req.query.locale,
        password: req.body.password,
        publicOnly: !actor
      })
      if (!page) {
        return reply.unauthorized('Incorrect password.')
      }
      /*
        Recorded per page rather than as a blanket "this session may read protected pages": each
        password is a separate secret, and knowing one says nothing about the others.

        Writing to the session is what creates one for an anonymous reader — `saveUninitialized` is
        off, so no row exists until this point. That is the intent: the unlock has to outlive the
        request, and it is the reader's own deliberate action that starts it.
      */
      req.session.unlockedPages = [...new Set([...(req.session.unlockedPages ?? []), page.id])]
      return page
    }
  )

  /**
   * CREATE PAGE
   */
  app.post<{ Params: { siteId: string }; Body: PageInput }>(
    '/sites/:siteId/pages',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions are
        granted by a group's RULES. Checked against the page in question below instead — which is
        also what lets a rule open one branch to somebody the group as a whole cannot write to.
      */
      schema: {
        summary: 'Create a page',
        description:
          'The content is the source and `render` is the HTML the editor produced from it. The render is sanitized against what the author may embed, stripped of editor scaffolding, given heading anchors, and reduced to a table of contents and search text — so read the response rather than assuming what was sent is what was stored.',
        tags: ['Pages'],
        params: siteIdParam,
        body: {
          allOf: [
            { $ref: 'PageInput#' },
            { type: 'object', required: ['path', 'title', 'editor', 'content'] }
          ]
        },
        response: {
          200: {
            description: 'Page created successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              page: { $ref: 'Page#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized('Saving a page requires a logged in user.')
      }
      // -> Against where the page is going: there is no page to ask about yet
      if (!mayOnPage(req, 'write:pages', { path: req.body.path, locale: req.body.locale })) {
        return reply.forbidden('You are not allowed to create a page here.')
      }
      const page = await WIKI.models.pages.createPage(req.params.siteId, req.body, actor)
      return {
        ok: true,
        message: 'Page created successfully.',
        page
      }
    }
  )

  /**
   * UPDATE PAGE
   */
  app.patch<{ Params: { siteId: string; pageId: string }; Body: Partial<PageInput> }>(
    '/sites/:siteId/pages/:pageId',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions are
        granted by a group's RULES. Checked against the page in question below instead — which is
        also what lets a rule open one branch to somebody the group as a whole cannot write to.
      */
      schema: {
        summary: 'Update a page',
        description:
          'Accepts any subset of the fields. Sending `render` replaces the stored HTML, its table of contents and its search text; sending `content` without it leaves the previous render in place, which is what a source-only edit means.',
        tags: ['Pages'],
        params: pageIdParam,
        body: { $ref: 'PageInput#' },
        response: {
          200: {
            description: 'Page updated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              page: { $ref: 'Page#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized('Saving a page requires a logged in user.')
      }
      const target = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        id: req.params.pageId
      })
      if (!target) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'write:pages', target)) {
        return reply.forbidden('You are not allowed to edit this page.')
      }
      const page = await WIKI.models.pages.updatePage(
        req.params.siteId,
        req.params.pageId,
        req.body,
        actor
      )
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      /*
        Anyone else editing this page right now is looking at the text that was just stored, so their
        editor should stop calling it unsaved. Told through the collaboration room rather than answered
        here, since they are on their own requests — and, quite possibly, on another instance.
      */
      WIKI.collab.pageSaved(page.id, {
        versionDate: page.updatedAt.toTemporalInstant().toString({ smallestUnit: 'millisecond' }),
        authorId: actor.id,
        authorName: page.authorName ?? ''
      })
      return {
        ok: true,
        message: 'Page updated successfully.',
        page
      }
    }
  )

  /**
   * MOVE / RENAME PAGE
   */
  app.put<{
    Params: { siteId: string; pageId: string }
    Body: { path: string; title?: string }
  }>(
    '/sites/:siteId/pages/:pageId/path',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions are
        granted by a group's RULES. Checked against the page in question below instead — which is
        also what lets a rule open one branch to somebody the group as a whole cannot write to.
      */
      schema: {
        summary: 'Move a page to another path',
        description:
          'Also renames it when a title is given. The tree entry moves with it, and any folder the new path needs is created.',
        tags: ['Pages'],
        params: pageIdParam,
        body: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              maxLength: 255,
              pattern: '^/?[a-zA-Z0-9-_/]*$'
            },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          }
        },
        response: {
          200: {
            description: 'Page moved successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              page: { $ref: 'Page#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized('Moving a page requires a logged in user.')
      }
      const target = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        id: req.params.pageId
      })
      if (!target) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'manage:pages', target)) {
        return reply.forbidden('You are not allowed to move this page.')
      }
      const page = await WIKI.models.pages.movePage(
        req.params.siteId,
        req.params.pageId,
        req.body,
        actor
      )
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      return {
        ok: true,
        message: 'Page moved successfully.',
        page
      }
    }
  )

  /**
   * RE-RENDER PAGE
   */
  app.post<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/render',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions are
        granted by a group's RULES. Checked against the page in question below instead — which is
        also what lets a rule open one branch to somebody the group as a whole cannot write to.
      */
      schema: {
        summary: 'Render a page again from its source',
        description:
          'For when a stored render has gone stale and nobody has the page open to re-save it. The markdown pipeline lives in the frontend, so the server drives it in a headless browser and the result matches what the editor would produce — which means this needs the Puppeteer extension, and answers 503 without it.',
        tags: ['Pages'],
        params: pageIdParam,
        response: {
          200: {
            description: 'Page rendered successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              page: { $ref: 'Page#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized('Rendering a page requires a logged in user.')
      }
      const target = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        id: req.params.pageId
      })
      if (!target) {
        return reply.notFound('This page does not exist.')
      }
      // -> Rewrites what the page shows, so it is an edit and takes the same permission as one
      if (!mayOnPage(req, 'write:pages', target)) {
        return reply.forbidden('You are not allowed to edit this page.')
      }
      const page = await WIKI.models.pages.rerenderPage(req.params.siteId, req.params.pageId, actor)
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      return {
        ok: true,
        message: 'Page rendered successfully.',
        page
      }
    }
  )

  /**
   * DELETE PAGE
   */
  app.delete<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions are
        granted by a group's RULES. Checked against the page in question below instead — which is
        also what lets a rule open one branch to somebody the group as a whole cannot write to.
      */
      schema: {
        summary: 'Delete a page',
        tags: ['Pages'],
        params: pageIdParam,
        response: {
          204: {
            description: 'Page deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized('Deleting a page requires a logged in user.')
      }
      const target = await WIKI.models.pages.getPage({
        siteId: req.params.siteId,
        id: req.params.pageId
      })
      if (!target) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'delete:pages', target)) {
        return reply.forbidden('You are not allowed to delete this page.')
      }
      if (!(await WIKI.models.pages.deletePage(req.params.siteId, req.params.pageId, actor))) {
        return reply.notFound('This page does not exist.')
      }
      return reply.code(204).send()
    }
  )

  /**
   * PAGE HISTORY
   */
  app.get<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/history',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and `read:history` is a
        page permission granted by a rule. Checked against this page below instead.
      */
      schema: {
        summary: "Get a page's version history",
        description:
          'Every recorded version of the page, newest first — the first entry is the page as it stands now.\n\nNeeds `read:history` ON THIS PAGE, granted by a group rule — the permission that says who may see what a page used to contain. Reading the page itself is required on top, so a page the caller could not open answers 404 and a password-protected one answers only once the session has satisfied `POST …/unlock`.',
        tags: ['Pages'],
        params: pageIdParam,
        response: {
          200: {
            description: 'Versions of this page, newest first',
            type: 'array',
            items: { $ref: 'PageHistoryEntry#' }
          }
        }
      }
    },
    async (req, reply) => {
      const page = await loadReadablePage(req, req.params.siteId, req.params.pageId)
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'read:history', page)) {
        return reply.forbidden("You are not allowed to read this page's history.")
      }
      if (page.isLocked) {
        return reply.forbidden('This page is password protected.')
      }
      return WIKI.models.pageHistory.list(req.params.siteId, req.params.pageId)
    }
  )

  /**
   * PAGE HISTORY VERSION
   */
  app.get<{ Params: { siteId: string; pageId: string; versionId: string } }>(
    '/sites/:siteId/pages/:pageId/history/:versionId',
    {
      // -> Checked per page below, for the same reason as the history list above
      schema: {
        summary: 'Get a single version of a page',
        description:
          'One version in full, source included — one side of a comparison. Needs `read:history` and the ability to read the page, on the same terms as the history list.',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            pageId: {
              type: 'string',
              format: 'uuid'
            },
            versionId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId', 'pageId', 'versionId']
        },
        response: {
          200: { $ref: 'PageHistoryVersion#' }
        }
      }
    },
    async (req, reply) => {
      const page = await loadReadablePage(req, req.params.siteId, req.params.pageId)
      if (!page) {
        return reply.notFound('This page does not exist.')
      }
      if (!mayOnPage(req, 'read:history', page)) {
        return reply.forbidden("You are not allowed to read this page's history.")
      }
      if (page.isLocked) {
        return reply.forbidden('This page is password protected.')
      }
      const version = await WIKI.models.pageHistory.getVersion(
        req.params.siteId,
        req.params.pageId,
        req.params.versionId
      )
      if (!version) {
        return reply.notFound('This version does not exist.')
      }
      return version
    }
  )

  /**
   * RESOLVE ALIAS
   */
  app.get<{ Params: { siteId: string; alias: string } }>(
    '/sites/:siteId/pages/alias/:alias',
    {
      /*
        No route-level `permissions`: that hook reads the group-wide list, and page permissions are
        granted by a group's RULES. Checked against the page in question below instead — which is
        also what lets a rule open one branch to somebody the group as a whole cannot write to.
      */
      schema: {
        summary: 'Resolve a page alias to its path',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            alias: {
              type: 'string',
              maxLength: 255,
              pattern: '^[a-zA-Z0-9-_]+$'
            }
          },
          required: ['siteId', 'alias']
        },
        response: {
          200: {
            description: 'The page the alias points at',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              path: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const target = await WIKI.models.pages.getPathFromAlias(req.params.siteId, req.params.alias)
      if (!target) {
        return reply.notFound('No page uses this alias.')
      }
      // -> Resolving an alias tells the caller a page exists and where it is, which is only theirs
      //    to know if they may read it
      if (!mayOnPage(req, 'read:pages', { path: target.path })) {
        return reply.notFound('No page uses this alias.')
      }
      return target
    }
  )

  /**
   * PAGE USER PERMISSIONS
   */
  app.post<{ Params: { siteId: string }; Body: { path: string } }>(
    '/sites/:siteId/pages/userPermissions',
    {
      schema: {
        summary: 'Get page user permissions',
        description:
          "Which page permissions the caller holds AT THIS PATH, as their groups' rules decide. This is what the interface hides its controls by, so it answers the same question the endpoints themselves do rather than a broader one.\n\nAn administrator holds all of them. Everybody else gets whatever their rules grant, which for a path nobody wrote a rule for is nothing at all.",
        tags: ['Pages'],
        params: siteIdParam,
        body: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          },
          examples: [
            {
              path: 'foo/bar'
            }
          ]
        },
        response: {
          200: {
            description: 'Permissions the current user holds for this page',
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    async (req) => {
      return pagePermissionsFor(req, { path: req.body.path.replace(/^\/+/, '') })
    }
  )
}

export default routes
