import type { FastifyInstance } from 'fastify'

/**
 * Tag API Routes
 *
 * Tags are derived from the pages that carry them rather than stored on their own — see
 * `models/tags.ts` for why.
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST TAGS
   */
  app.get<{ Params: { siteId: string }; Querystring: { limit?: number } }>(
    '/sites/:siteId/tags',
    {
      /*
        No route-level `permissions`: a tag exists because a readable page carries it, so the answer
        is filtered per page below rather than refused outright.
      */
      schema: {
        summary: 'List the tags in use on a site',
        description:
          'Every tag carried by at least one page the caller may read, most used first, counted over those pages only. This is what the tag field offers as suggestions while a page is being edited, and what the search screen filters by.',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId']
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 5000,
              default: 1000
            }
          }
        },
        response: {
          200: {
            description: 'Tags in use, most used first',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tag: {
                  type: 'string'
                },
                usageCount: {
                  type: 'integer',
                  description: 'How many pages carry the tag.'
                }
              }
            }
          }
        }
      }
    },
    async (req) => {
      return WIKI.models.tags.getTags(req.params.siteId, {
        limit: req.query.limit,
        actor: WIKI.models.groups.actorForRequest(req)
      })
    }
  )

  /**
   * LIST TAGS ACROSS EVERY SITE
   */
  app.get<{ Querystring: { limit?: number } }>(
    '/tags',
    {
      config: {
        /*
          A page rule is not a site's: one may name several sites, or none and mean all of them, so
          the group editor's tag field cannot be filled from one site's list. Gated on reading
          groups for that reason — it exists to be that field's options, and whoever may read a
          group already sees the tags its rules name.
        */
        permissions: ['read:groups', 'manage:groups']
      },
      schema: {
        summary: 'List the tags in use across every site',
        description:
          "Every tag carried by at least one page on the instance, most used first. This is what the group editor's page-rule tag field offers, since a rule is not limited to one site.\n\nUnlike the per-site listing this is not narrowed to the pages the caller may read: a rule acts on a tag whether or not the person writing it can see the pages carrying it, so a filtered list would hide tags the rule still matches.",
        tags: ['Pages'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 5000,
              default: 1000
            }
          }
        },
        response: {
          200: {
            description: 'Tags in use, most used first',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tag: {
                  type: 'string'
                },
                usageCount: {
                  type: 'integer',
                  description: 'How many pages carry the tag, counted across every site.'
                }
              }
            }
          }
        }
      }
    },
    async (req) => {
      return WIKI.models.tags.getAllTags({ limit: req.query.limit })
    }
  )
}

export default routes
