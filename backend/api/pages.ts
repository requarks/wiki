import { validate as uuidValidate } from 'uuid'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PageActor, PageInput } from '../models/pages.ts'
import { SEARCH_ORDER_BY, type SearchOrderBy } from '../models/search.ts'

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
function actorFrom(req: FastifyRequest): PageActor | null {
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
 * Every page permission a group can be granted, i.e. the whole set `manage:system` amounts to. Mirrors
 * the page rules offered in the group editor.
 */
const PAGE_PERMISSIONS = [
  'read:pages',
  'write:pages',
  'review:pages',
  'manage:pages',
  'delete:pages'
]

function mayBypassPassword(req: FastifyRequest): boolean {
  const permissions = req.apiKey?.permissions ?? req.session?.permissions ?? []
  return PASSWORD_BYPASS.some((permission) => permissions.includes(permission))
}

/**
 * Whether the password on a page has already been satisfied for this request.
 *
 * The unlock is recorded on the session — server side, by page id — so that reading a page the reader
 * unlocked a moment ago does not ask again, and so that nothing the browser can set decides this.
 */
function unlockedFor(req: FastifyRequest, pageId: string): boolean {
  return mayBypassPassword(req) || Boolean(req.session?.unlockedPages?.includes(pageId))
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
      config: {
        permissions: ['read:pages', 'manage:pages']
      },
      schema: {
        summary: 'List all pages',
        description:
          'Not implemented yet — always answers with an empty list. Browse the tree instead, which is what the file manager and the navigation use.',
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
      return page
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
      config: {
        permissions: ['write:pages', 'manage:pages']
      },
      schema: {
        summary: 'Create a page',
        description:
          'The content is the source and `render` is the HTML the editor produced from it. The render is sanitized against what the author may embed, stripped of editor scaffolding, given heading anchors, and reduced to a table of contents and search text — so read the response rather than assuming what was sent is what was stored.',
        tags: ['Pages'],
        params: siteIdParam,
        body: {
          allOf: [{ $ref: 'PageInput#' }, { required: ['path', 'title', 'editor', 'content'] }]
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
      config: {
        permissions: ['write:pages', 'manage:pages']
      },
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
      const page = await WIKI.models.pages.updatePage(
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
      config: {
        permissions: ['manage:pages']
      },
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
      config: {
        permissions: ['write:pages', 'manage:pages']
      },
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
      config: {
        permissions: ['delete:pages', 'manage:pages']
      },
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
      if (!(await WIKI.models.pages.deletePage(req.params.siteId, req.params.pageId, actor))) {
        return reply.notFound('This page does not exist.')
      }
      return reply.code(204).send()
    }
  )

  /**
   * RESOLVE ALIAS
   */
  app.get<{ Params: { siteId: string; alias: string } }>(
    '/sites/:siteId/pages/alias/:alias',
    {
      config: {
        permissions: ['read:pages', 'manage:pages']
      },
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
          "The current user's page permissions, which are not yet scoped per path — every page in the site answers the same.",
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
      const actor = actorFrom(req)
      if (!actor) {
        return []
      }
      /*
        An administrator holds all of them, and holds them here too. Filtering their permissions by
        name the way the line below does would answer `manage:system` → nothing ending in `:pages` →
        that an administrator has no rights over any page, which is the opposite of true.
      */
      if (actor.permissions.includes('manage:system')) {
        return PAGE_PERMISSIONS
      }
      // FIXME: per-path permission rules are not implemented — a group's page permissions apply to
      // the whole site, so this returns what the user holds anywhere rather than here.
      return actor.permissions.filter((p) => p.endsWith(':pages'))
    }
  )
}

export default routes
