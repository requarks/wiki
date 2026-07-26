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
      config: {
        permissions: ['read:pages', 'write:pages', 'manage:pages']
      },
      schema: {
        summary: 'List the tags in use on a site',
        description:
          'Every tag carried by at least one page, most used first. This is what the tag field offers as suggestions while a page is being edited.',
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
      return WIKI.models.tags.getTags(req.params.siteId, { limit: req.query.limit })
    }
  )
}

export default routes
