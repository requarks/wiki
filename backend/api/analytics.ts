import { audit } from '../helpers/audit.ts'
import type { FastifyInstance } from 'fastify'
import type { AnalyticsProviderInput } from '../models/analytics.ts'

/**
 * Analytics API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * GET SITE ANALYTICS CONFIGURATION
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/analytics',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Get the analytics configuration of a site',
        description:
          'One entry per analytics module installed in `modules/analytics`, whether or not it has ever been enabled, each with the values this site has configured for it. Nothing is masked: every value here ends up in the HTML the site serves, so none of it can be a secret.',
        tags: ['Analytics'],
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
        response: {
          200: {
            description: 'Analytics configuration of the site',
            type: 'object',
            properties: {
              providers: {
                type: 'array',
                items: { $ref: 'AnalyticsProvider#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }
      return { providers: WIKI.models.analytics.getSiteProviders(req.params.siteId) }
    }
  )

  /**
   * UPDATE SITE ANALYTICS CONFIGURATION
   */
  app.put<{
    Params: { siteId: string }
    Body: { providers?: AnalyticsProviderInput[] }
  }>(
    '/sites/:siteId/analytics',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Update the analytics configuration of a site',
        description:
          'Only the providers listed are affected, and within each of them only the props the module declares. Everything is validated before any of it is written, so a rejected request changes nothing. A saved change applies to the next document the site serves, on every instance.',
        tags: ['Analytics'],
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
        body: {
          type: 'object',
          properties: {
            providers: {
              type: 'array',
              items: { $ref: 'AnalyticsProviderInput#' }
            }
          }
        },
        response: {
          200: {
            description: 'Analytics configuration updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              updated: {
                type: 'integer',
                description:
                  'How many providers were written. One already in the requested state still counts.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }

      // -> Validated as a whole first: the admin area saves every provider at once, and a partially
      //    applied configuration is worse than a refused one
      const patches = req.body.providers ?? []
      for (const patch of patches) {
        const invalid = WIKI.models.analytics.validateProvider(patch)
        if (invalid) {
          return reply.badRequest(invalid)
        }
      }

      const updated = await WIKI.models.analytics.updateSiteProviders(req.params.siteId, patches)

      /*
        Which providers were written and whether each was turned on — not the values, which are
        identifiers of accounts at a third party rather than anything about this wiki. `meta` carries
        identity and never payload.
      */
      await audit(req, 'admin', 'updateAnalytics', {
        siteId: req.params.siteId,
        providers: patches.map((patch) => ({
          key: patch.key,
          isEnabled: patch.isEnabled,
          changedFields: Object.keys(patch.config ?? {})
        }))
      })

      return {
        ok: true,
        message: 'Analytics configuration updated successfully.',
        updated
      }
    }
  )
}

export default routes
