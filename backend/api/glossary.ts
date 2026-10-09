import { createHash } from 'node:crypto'

import { audit } from '../helpers/audit.ts'
import { GLOSSARY_INPUT_PROPERTIES } from './schemas/glossary.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { GlossaryTermInput, GlossaryWriteResult } from '../models/glossary.ts'

const siteIdParam = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId']
}

const termIdParam = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    termId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'termId']
}

const localeQuery = {
  type: 'object',
  properties: {
    locale: { type: 'string', minLength: 1, maxLength: 255 }
  },
  required: ['locale']
}

const conflictResponse = {
  description:
    'Another term already holds one of the names (`nameTaken`), or somebody saved this term since it was opened (`stale`, with the term as it now stands).',
  $ref: 'GlossaryConflict#'
}

/** Whether the caller may read this site's glossary in this locale — `read:glossary`, path ignored. */
function mayRead(req: FastifyRequest, siteId: string, locale: string): boolean {
  return WIKI.models.groups.checkLocaleAccess(
    WIKI.models.groups.actorForRequest(req),
    'read:glossary',
    siteId,
    locale
  )
}

/** Whether the caller may edit this site's glossary in this locale — `manage:glossary`, path ignored. */
function mayManage(req: FastifyRequest, siteId: string, locale: string): boolean {
  return WIKI.models.groups.checkLocaleAccess(
    WIKI.models.groups.actorForRequest(req),
    'manage:glossary',
    siteId,
    locale
  )
}

/**
 * The checks every write to an existing term makes: the site and its switch, the term, then
 * `manage:glossary` in the term's own locale. A term the caller may not even read answers 404, as it
 * does on the read route.
 *
 * @returns The term's locale when the handler may go on; when not, the reply has been sent
 */
async function guardWrite(
  req: FastifyRequest,
  reply: FastifyReply,
  siteId: string,
  termId: string
): Promise<string | null> {
  if (!WIKI.sites[siteId] || !WIKI.models.glossary.isEnabled(siteId)) {
    reply.notFound('This site has no glossary.')
    return null
  }
  const locale = await WIKI.models.glossary.localeOf(siteId, termId)
  if (!locale || !mayRead(req, siteId, locale)) {
    reply.notFound('This term does not exist.')
    return null
  }
  if (!mayManage(req, siteId, locale)) {
    reply.forbidden('You may not edit the glossary in this locale.')
    return null
  }
  return locale
}

/**
 * The checks every locale-scoped read makes, in the order that leaks least: the site, then the
 * permission, then whether the locale is one the site offers.
 *
 * @returns Whether the handler may go on; when not, the reply has been sent
 */
function guardRead(req: FastifyRequest, reply: FastifyReply, siteId: string, locale: string) {
  if (!WIKI.sites[siteId]) {
    reply.notFound('Site does not exist.')
    return false
  }
  if (!mayRead(req, siteId, locale)) {
    reply.forbidden('You may not read the glossary in this locale.')
    return false
  }
  if (!WIKI.models.glossary.isActiveLocale(siteId, locale)) {
    reply.badRequest('This locale is not active on this site.')
    return false
  }
  return true
}

/** Send a refused write as the status it stands for. */
function sendRefusal(
  reply: FastifyReply,
  result: Exclude<GlossaryWriteResult, { ok: true }>
): FastifyReply {
  switch (result.reason) {
    case 'notFound':
      return reply.notFound('This term does not exist.')
    case 'invalidRelated':
      return reply.badRequest(
        'A related term does not exist, is in another locale, or is the term itself.'
      )
    case 'nameTaken':
      return reply.code(409).send({
        ok: false,
        statusCode: 409,
        error: 'Conflict',
        message: `"${result.name}" is already used by the term "${result.holder.term}".`,
        reason: 'nameTaken',
        field: result.field,
        name: result.name,
        holder: result.holder
      })
    case 'stale':
      return reply.code(409).send({
        ok: false,
        statusCode: 409,
        error: 'Conflict',
        message: 'This term was changed by somebody else since it was opened.',
        reason: 'stale',
        current: result.current
      })
  }
}

/**
 * Glossary API Routes
 *
 * A site's glossary, one per locale. See `dev/specs/glossary.md`.
 *
 * **Reading** is `read:glossary` and **writing** `manage:glossary`, both PAGE permissions whose rule's
 * path is ignored: they are asked per site and locale. So no route here declares route-level
 * `permissions` (the hook reads the group-wide list only), and every one asks
 * `groups.checkLocaleAccess` in the handler — a write against the locale of the term it touches.
 *
 * With `features.glossary` off the reads answer as though there were no terms and the writes 404, so
 * that the switch hides the glossary without deleting it.
 */
async function routes(app: FastifyInstance) {
  /**
   * GLOSSARY ACCESS
   */
  // -> No route-level permissions: what it reports IS the permission, per locale
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/glossary/access',
    {
      schema: {
        summary: 'What the caller may do with the glossary',
        description:
          "Whether the site has a glossary, and the active locales the caller may read it in and edit it in. This is what decides whether the interface offers the glossary at all; it is asked once per site and session rather than per page, since neither permission depends on the page.\n\n`read:glossary` and `manage:glossary` are page permissions whose rule's path is ignored: every rule naming one that is scoped to the site and the locale applies, ALLOW < DENY < FORCE ALLOW. `manage:glossary` in a locale implies `read:glossary` there.",
        tags: ['Glossary'],
        params: siteIdParam,
        response: {
          200: {
            description: 'Glossary access of the caller',
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description: 'The site’s `features.glossary` switch.'
              },
              readableLocales: {
                type: 'array',
                items: { type: 'string' },
                description: 'The active locales the caller may read the glossary in.'
              },
              manageableLocales: {
                type: 'array',
                items: { type: 'string' },
                description: 'The active locales the caller may edit the glossary in.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = WIKI.sites[req.params.siteId]
      if (!site) {
        return reply.notFound('Site does not exist.')
      }
      const active: string[] = site.config?.locales?.active ?? []
      return {
        enabled: WIKI.models.glossary.isEnabled(req.params.siteId),
        readableLocales: active.filter((locale) => mayRead(req, req.params.siteId, locale)),
        manageableLocales: active.filter((locale) => mayManage(req, req.params.siteId, locale))
      }
    }
  )

  /**
   * LIST TERMS
   */
  // -> No route-level permissions: `read:glossary` is a page rule. See the note above.
  app.get<{ Params: { siteId: string }; Querystring: { locale: string } }>(
    '/sites/:siteId/glossary',
    {
      schema: {
        summary: 'List the glossary terms of a locale',
        description:
          'Every term in the locale, A–Z, with what the glossary’s list shows. The definition and the rest come from the single-term route.\n\nNeeds `read:glossary` in the locale. Empty while the site’s glossary is switched off.',
        tags: ['Glossary'],
        params: siteIdParam,
        querystring: localeQuery,
        response: {
          200: {
            description: 'The terms of the locale, A–Z',
            type: 'array',
            items: { $ref: 'GlossaryTermSummary#' }
          }
        }
      }
    },
    async (req, reply) => {
      if (!guardRead(req, reply, req.params.siteId, req.query.locale)) {
        return reply
      }
      if (!WIKI.models.glossary.isEnabled(req.params.siteId)) {
        return []
      }
      return WIKI.models.glossary.list(req.params.siteId, req.query.locale)
    }
  )

  /**
   * LIST CATEGORIES
   */
  // -> No route-level permissions: `read:glossary` is a page rule. See the note above.
  app.get<{ Params: { siteId: string }; Querystring: { locale: string } }>(
    '/sites/:siteId/glossary/categories',
    {
      schema: {
        summary: 'List the glossary categories of a locale',
        description:
          'Every category a term in the locale carries, A–Z — what the form suggests.\n\nNeeds `read:glossary` in the locale. Empty while the site’s glossary is switched off.',
        tags: ['Glossary'],
        params: siteIdParam,
        querystring: localeQuery,
        response: {
          200: {
            description: 'Categories in use, A–Z',
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    async (req, reply) => {
      if (!guardRead(req, reply, req.params.siteId, req.query.locale)) {
        return reply
      }
      if (!WIKI.models.glossary.isEnabled(req.params.siteId)) {
        return []
      }
      return WIKI.models.glossary.categories(req.params.siteId, req.query.locale)
    }
  )

  /**
   * AUTO-LINK LIST
   */
  // -> No route-level permissions: `read:glossary` is a page rule. See the note above.
  app.get<{ Params: { siteId: string }; Querystring: { locale: string } }>(
    '/sites/:siteId/glossary/autolink',
    {
      schema: {
        summary: 'List the glossary terms linked in page text',
        description:
          'The terms of a locale that pages link automatically — those with `autoLink` on — with what finding them in text takes: the name, the aliases and whether case matters. Fetched once per locale by a reader’s browser and revalidated with the `ETag` it answers with, which changes whenever any term of the locale does.\n\nNeeds `read:glossary` in the locale. Empty while the site’s glossary, or its `features.glossaryAutoLink`, is switched off.',
        tags: ['Glossary'],
        params: siteIdParam,
        querystring: localeQuery,
        response: {
          200: {
            description: 'The terms to link',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                term: { type: 'string' },
                expansion: { type: 'string', nullable: true },
                aliases: { type: 'array', items: { type: 'string' } },
                caseSensitive: { type: 'boolean' }
              }
            }
          },
          304: { description: 'Nothing has changed since the ETag sent', type: 'null' }
        }
      }
    },
    async (req, reply) => {
      const { siteId } = req.params
      if (!guardRead(req, reply, siteId, req.query.locale)) {
        return reply
      }
      const enabled = WIKI.models.glossary.isAutoLinkEnabled(siteId)
      const version = enabled
        ? await WIKI.models.glossary.version(siteId, req.query.locale)
        : { count: 0, latestAt: '' }
      /*
        The same list for everybody who may read it, so the tag names the glossary and not the caller:
        the permission is checked above on every request, 304 included. The switch is in it too, so
        turning auto-linking off reaches a browser holding the list from before.
      */
      const etag = `"${createHash('sha1')
        .update(`${siteId}|${req.query.locale}|${enabled}|${version.count}|${version.latestAt}`)
        .digest('base64url')}"`
      reply.header('Cache-Control', 'private, no-cache')
      reply.header('ETag', etag)
      if (req.headers['if-none-match'] === etag) {
        return reply.code(304).send()
      }
      return enabled ? WIKI.models.glossary.autoLinkList(siteId, req.query.locale) : []
    }
  )

  /**
   * LOOK UP A TERM BY NAME
   */
  // -> No route-level permissions: `read:glossary` is a page rule. See the note above.
  app.get<{ Params: { siteId: string }; Querystring: { locale: string; name: string } }>(
    '/sites/:siteId/glossary/lookup',
    {
      schema: {
        summary: 'Find a glossary term by name',
        description:
          'The term a name belongs to, as its own name or as one of its aliases, compared without regard to case. What a link to a term by name resolves through.\n\nNeeds `read:glossary` in the locale.',
        tags: ['Glossary'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            locale: { type: 'string', minLength: 1, maxLength: 255 },
            name: { type: 'string', minLength: 1, maxLength: 255 }
          },
          required: ['locale', 'name']
        },
        response: {
          200: {
            description: 'The term the name belongs to',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!guardRead(req, reply, req.params.siteId, req.query.locale)) {
        return reply
      }
      const id = WIKI.models.glossary.isEnabled(req.params.siteId)
        ? await WIKI.models.glossary.lookup(req.params.siteId, req.query.locale, req.query.name)
        : null
      if (!id) {
        return reply.notFound('No term goes by this name.')
      }
      return { id }
    }
  )

  /**
   * GET A TERM
   */
  // -> No route-level permissions: `read:glossary` is a page rule. See the note above.
  app.get<{ Params: { siteId: string; termId: string } }>(
    '/sites/:siteId/glossary/:termId',
    {
      schema: {
        summary: 'Get a glossary term',
        description:
          'A term in full: its definition, related terms (from both sides), documentation page as it now resolves, and references.\n\nNeeds `read:glossary` in the term’s locale.',
        tags: ['Glossary'],
        params: termIdParam,
        response: {
          200: {
            description: 'The term',
            $ref: 'GlossaryTerm#'
          }
        }
      }
    },
    async (req, reply) => {
      const term = WIKI.models.glossary.isEnabled(req.params.siteId)
        ? await WIKI.models.glossary.get(req.params.siteId, req.params.termId)
        : null
      // -> One answer for a term that is not there and one the caller may not read: the difference
      //    is not something to tell whoever is asking
      if (!term || !mayRead(req, req.params.siteId, term.locale)) {
        return reply.notFound('This term does not exist.')
      }
      return term
    }
  )

  /**
   * CREATE A TERM
   */
  // -> No route-level permissions: `manage:glossary` is a page rule. See the note above.
  app.post<{ Params: { siteId: string }; Body: GlossaryTermInput & { locale: string } }>(
    '/sites/:siteId/glossary',
    {
      schema: {
        summary: 'Create a glossary term',
        description:
          'Needs `manage:glossary` in the locale.\n\nThe term’s name and its aliases must not be held by any other term of the locale, as a name or an alias, compared without regard to case; a clash answers 409 naming the term that holds it.\n\nThe locale is fixed here for good: a term in another locale is a different term.',
        tags: ['Glossary'],
        params: siteIdParam,
        body: {
          type: 'object',
          required: ['locale', 'term'],
          properties: {
            locale: { type: 'string', minLength: 1, maxLength: 255 },
            ...GLOSSARY_INPUT_PROPERTIES
          }
        },
        response: {
          200: {
            description: 'The term as created',
            $ref: 'GlossaryTerm#'
          },
          409: conflictResponse
        }
      }
    },
    async (req, reply) => {
      const { siteId } = req.params
      if (!WIKI.sites[siteId] || !WIKI.models.glossary.isEnabled(siteId)) {
        return reply.notFound('This site has no glossary.')
      }
      if (!mayManage(req, siteId, req.body.locale)) {
        return reply.forbidden('You may not edit the glossary in this locale.')
      }
      if (!WIKI.models.glossary.isActiveLocale(siteId, req.body.locale)) {
        return reply.badRequest('This locale is not active on this site.')
      }
      const result = await WIKI.models.glossary.create(
        siteId,
        req.body.locale,
        req.body,
        req.session?.user?.id ?? null
      )
      if (!result.ok) {
        return sendRefusal(reply, result)
      }
      await audit(req, 'glossary', 'createGlossaryTerm', {
        siteId,
        locale: result.term.locale,
        termId: result.term.id,
        term: result.term.term
      })
      return result.term
    }
  )

  /**
   * UPDATE A TERM
   */
  // -> No route-level permissions: `manage:glossary` is a page rule. See the note above.
  app.put<{
    Params: { siteId: string; termId: string }
    Body: GlossaryTermInput & { expectedUpdatedAt: string }
  }>(
    '/sites/:siteId/glossary/:termId',
    {
      schema: {
        summary: 'Update a glossary term',
        description:
          'Needs `manage:glossary` in the term’s locale.\n\nReplaces the term, related terms included: a term taken out of `relatedTerms` loses this one from its own list too.\n\n`expectedUpdatedAt` is the `updatedAt` the term was opened with. When somebody has saved it since, nothing is written and the answer is 409 with the term as it now stands; re-sending with that `updatedAt` saves over it.',
        tags: ['Glossary'],
        params: termIdParam,
        body: {
          type: 'object',
          required: ['term', 'expectedUpdatedAt'],
          properties: {
            ...GLOSSARY_INPUT_PROPERTIES,
            expectedUpdatedAt: { type: 'string', format: 'date-time' }
          }
        },
        response: {
          200: {
            description: 'The term as saved',
            $ref: 'GlossaryTerm#'
          },
          409: conflictResponse
        }
      }
    },
    async (req, reply) => {
      const { siteId, termId } = req.params
      if (!(await guardWrite(req, reply, siteId, termId))) {
        return reply
      }
      const result = await WIKI.models.glossary.update(
        siteId,
        termId,
        req.body,
        req.body.expectedUpdatedAt,
        req.session?.user?.id ?? null
      )
      if (!result.ok) {
        return sendRefusal(reply, result)
      }
      await audit(req, 'glossary', 'updateGlossaryTerm', {
        siteId,
        locale: result.term.locale,
        termId,
        term: result.term.term,
        changedFields: result.changedFields
      })
      return result.term
    }
  )

  /**
   * DELETE A TERM
   */
  // -> No route-level permissions: `manage:glossary` is a page rule. See the note above.
  app.delete<{ Params: { siteId: string; termId: string } }>(
    '/sites/:siteId/glossary/:termId',
    {
      schema: {
        summary: 'Delete a glossary term',
        description:
          'Needs `manage:glossary` in the term’s locale. The term leaves every other term’s related list with it.',
        tags: ['Glossary'],
        params: termIdParam,
        response: {
          200: {
            description: 'Term deleted',
            type: 'object',
            properties: {
              ok: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const { siteId, termId } = req.params
      if (!(await guardWrite(req, reply, siteId, termId))) {
        return reply
      }
      const deleted = await WIKI.models.glossary.remove(siteId, termId)
      if (!deleted) {
        return reply.notFound('This term does not exist.')
      }
      await audit(req, 'glossary', 'deleteGlossaryTerm', {
        siteId,
        locale: deleted.locale,
        termId,
        term: deleted.term
      })
      return { ok: true }
    }
  )
}

export default routes
