import type { FastifyInstance } from 'fastify'
import type { StorageTargetInput } from '../models/storage.ts'

/**
 * Storage API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST SITE STORAGE TARGETS
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/storage/targets',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the storage targets of a site',
        description:
          'One target per storage module installed in `modules/storage`, whether or not it has ever been enabled. Configuration values include any credentials a module stores, hence the `manage:system` requirement. Note that no module ships an implementation yet: a target holds configuration, and nothing reads or writes content through it.',
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
            description: 'List of storage targets',
            type: 'array',
            items: { $ref: 'StorageTarget#' }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }
      return WIKI.models.storage.getSiteTargets(req.params.siteId)
    }
  )

  /**
   * UPDATE SITE STORAGE TARGETS
   */
  app.put<{ Params: { siteId: string }; Body: { targets: StorageTargetInput[] } }>(
    '/sites/:siteId/storage/targets',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update the storage targets of a site',
        description:
          'Only the targets listed are affected, and within each of them only the fields provided. Every target is validated before any of them is written, so a rejected request changes nothing.',
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
          required: ['targets'],
          properties: {
            targets: {
              type: 'array',
              items: { $ref: 'StorageTargetInput#' }
            }
          }
        },
        response: {
          200: {
            description: 'Storage targets updated successfully',
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
      const current = await WIKI.models.storage.getSiteTargets(req.params.siteId)
      const patches = []
      for (const patch of req.body.targets) {
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

      let updated = 0
      for (const { target, patch } of patches) {
        if (await WIKI.models.storage.updateTarget(req.params.siteId, target, patch)) {
          updated++
        }
      }

      return {
        ok: true,
        message: 'Storage targets updated successfully.',
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
          'The actions a target offers are listed with it. Only an enabled target can run one, and only a module with an implementation offers any — so every action currently fails, no module having one yet.',
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

      try {
        await WIKI.models.storage.executeAction(target, req.params.action)
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.badRequest(err.message)
      }

      return {
        ok: true,
        message: 'Action completed successfully.'
      }
    }
  )

  /**
   * RUN STORAGE TARGET SETUP STEP
   */
  app.post<{
    Params: { siteId: string; targetId: string }
    Body: Record<string, any>
  }>(
    '/sites/:siteId/storage/targets/:targetId/setup',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Advance the setup process of a storage target',
        description:
          'For modules that cannot be configured by hand, such as one backed by an app installed on a provider. The body is passed to the module as-is, and what comes back tells the admin area what to do next. Only a module with an implementation has a setup process — none does yet.',
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
            }
          },
          required: ['siteId', 'targetId']
        },
        body: {
          type: 'object',
          required: ['step'],
          additionalProperties: true,
          properties: {
            step: {
              type: 'string',
              maxLength: 255,
              description: 'Which step of the process to run, as named by the module.'
            }
          }
        },
        response: {
          200: {
            description: 'Setup step completed successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              state: {
                type: 'object',
                additionalProperties: true,
                description: 'What the module wants done next, e.g. `{ nextStep, url }`.'
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
      if (!target.setup) {
        return reply.badRequest(`${target.title} has no setup process.`)
      }

      try {
        const state = await WIKI.models.storage.runSetup(target, req.body)
        return {
          ok: true,
          message: 'Setup step completed successfully.',
          state
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.badRequest(err.message)
      }
    }
  )

  /**
   * DESTROY STORAGE TARGET SETUP
   */
  app.delete<{ Params: { siteId: string; targetId: string } }>(
    '/sites/:siteId/storage/targets/:targetId/setup',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Reset the setup of a storage target',
        description:
          'Undoes what the setup process configured, so that it can be started over. What that involves is up to the module.',
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
            }
          },
          required: ['siteId', 'targetId']
        },
        response: {
          200: {
            description: 'Setup reset successfully',
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
      if (!target.setup) {
        return reply.badRequest(`${target.title} has no setup process.`)
      }

      try {
        await WIKI.models.storage.destroySetup(target)
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.badRequest(err.message)
      }

      return {
        ok: true,
        message: 'Setup reset successfully.'
      }
    }
  )
}

export default routes
