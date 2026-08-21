import type { FastifyInstance } from 'fastify'
import type { StorageTargetInput } from '../models/storage.ts'

/**
 * Storage API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * GET SITE STORAGE CONFIGURATION
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/storage',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get the storage configuration of a site',
        description:
          'The site-wide settings, plus one target per storage module installed in `modules/storage`, whether or not it has ever been enabled. Configuration values include any credentials a module stores, hence the `manage:system` requirement. Where a given file is written and where it is read from are both derived from this configuration rather than recorded per file, so changing it changes where content is looked for, not where it already sits.',
        tags: ['Storage'],
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
            description: 'Storage configuration of the site',
            type: 'object',
            properties: {
              largeThreshold: {
                type: 'string',
                description:
                  'Size at or above which an asset counts as a large file, e.g. `5MB`. One answer for the whole site: a file has to be the same kind of thing to every target.'
              },
              targets: {
                type: 'array',
                items: { $ref: 'StorageTarget#' }
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
      return {
        largeThreshold: WIKI.models.storage.largeThresholdFor(req.params.siteId),
        targets: await WIKI.models.storage.getSiteTargets(req.params.siteId)
      }
    }
  )

  /**
   * UPDATE SITE STORAGE CONFIGURATION
   */
  app.put<{
    Params: { siteId: string }
    Body: { largeThreshold?: string; targets?: StorageTargetInput[] }
  }>(
    '/sites/:siteId/storage',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update the storage configuration of a site',
        description:
          'Only the targets listed are affected, and within each of them only the fields provided. Everything is validated before any of it is written, so a rejected request changes nothing.',
        tags: ['Storage'],
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
            largeThreshold: {
              type: 'string',
              maxLength: 32,
              description: 'A size such as `5MB`. Applies to every target of the site.'
            },
            targets: {
              type: 'array',
              items: { $ref: 'StorageTargetInput#' }
            }
          }
        },
        response: {
          200: {
            description: 'Storage configuration updated successfully',
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
                  'How many target rows were written. A target already in the requested state still counts.'
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

      // -> Validated as a whole first: a partially applied storage configuration is worse than a
      //    refused one, since the admin area saves every target at once
      const invalidConfig = WIKI.models.storage.validateSiteConfig(req.body)
      if (invalidConfig) {
        return reply.badRequest(invalidConfig)
      }
      const current = await WIKI.models.storage.getSiteTargets(req.params.siteId)
      const patches = []
      for (const patch of req.body.targets ?? []) {
        const target = current.find((t) => t.id === patch.id)
        if (!target) {
          return reply.notFound(`Storage target ${patch.id} does not exist.`)
        }
        const invalid = WIKI.models.storage.validateTarget(target, patch)
        if (invalid) {
          return reply.badRequest(invalid)
        }
        patches.push({ target, patch })
      }

      await WIKI.models.storage.updateSiteConfig(req.params.siteId, req.body)

      let updated = 0
      for (const { target, patch } of patches) {
        if (await WIKI.models.storage.updateTarget(req.params.siteId, target, patch)) {
          updated++
        }
      }

      return {
        ok: true,
        message: 'Storage configuration updated successfully.',
        updated
      }
    }
  )

  /**
   * EXECUTE STORAGE TARGET ACTION
   */
  app.post<{ Params: { siteId: string; targetId: string; action: string } }>(
    '/sites/:siteId/storage/targets/:targetId/actions/:action',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Run an action on a storage target',
        description:
          'The actions a target offers are listed with it, and only an enabled target can run one. An action runs to completion before the request is answered, so moving a large amount of content can take a while.',
        tags: ['Storage'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            targetId: {
              type: 'string',
              format: 'uuid'
            },
            action: {
              type: 'string',
              maxLength: 255
            }
          },
          required: ['siteId', 'targetId', 'action']
        },
        response: {
          200: {
            description: 'Action completed successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const target = await WIKI.models.storage.getSiteTargetById(
        req.params.siteId,
        req.params.targetId
      )
      if (!target) {
        return reply.notFound('Storage target does not exist.')
      }
      if (!target.isEnabled) {
        return reply.conflict('The storage target must be enabled before running an action.')
      }
      if (!target.actions.some((act) => act.handler === req.params.action)) {
        return reply.badRequest(`${target.title} has no "${req.params.action}" action.`)
      }
      // -> An action may create content, and content records who authored it. An API key is not a
      //    who, so these are reserved to a logged-in administrator.
      const actorId = req.session?.authenticated ? req.session.user?.id : null
      if (!actorId) {
        return reply.unauthorized('Running a storage action requires a logged in user.')
      }

      try {
        const message = await WIKI.models.storage.executeAction(target, req.params.action, actorId)
        return {
          ok: true,
          message: message ?? 'Action completed successfully.'
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.badRequest(err.message)
      }
    }
  )
}

export default routes
