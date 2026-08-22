import { maskSensitiveProps } from '../helpers/common.ts'
import { STORAGE_DIRECT_ACCESS_FALLBACKS, STORAGE_TARGET_STATUSES } from '../models/storage.ts'
import type { FastifyInstance } from 'fastify'
import type { StorageSiteConfigInput, StorageTargetInput } from '../models/storage.ts'

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
          'The site-wide settings, plus one target per storage module installed in `modules/storage`, whether or not it has ever been enabled. A configuration value belonging to a prop marked `sensitive` is write-only and comes back masked, never as the stored secret. Where a given file is written and where it is read from are both derived from this configuration rather than recorded per file, so changing it changes where content is looked for, not where it already sits.',
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
              sitePrefix: {
                type: 'boolean',
                description:
                  'Whether the paths a target stores content under are filed inside a folder named after the site. Off by default, since a target belongs to one site and its configured root is therefore already the folder of that site; turn it on for two sites sharing a location.'
              },
              localePrefix: {
                type: 'boolean',
                description:
                  'Whether the paths a target stores content under are bracketed by locale. On by default. Off, the site stores its primary locale only, directly under the root - content in any other locale has no path and is not written to a path-based target at all.'
              },
              syncInterval: {
                type: 'string',
                description:
                  'How often a target with a remote is synchronized, e.g. `5m` or `1h`. Applies to every target of the site that has a remote at all; the others have nothing to synchronize with and ignore it.'
              },
              directAccessFallback: {
                type: 'string',
                enum: [...STORAGE_DIRECT_ACCESS_FALLBACKS],
                description:
                  'What happens when a target set to hand out direct links cannot sign one. `stream` serves the bytes through the wiki instead, so a signing misconfiguration costs performance rather than breaking every image; `error` fails the request, so it cannot go unnoticed. Either way the target records a warning.'
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
      const layout = WIKI.models.storage.pathLayoutFor(req.params.siteId)
      return {
        largeThreshold: WIKI.models.storage.largeThresholdFor(req.params.siteId),
        sitePrefix: layout.sitePrefix,
        localePrefix: layout.localePrefix,
        syncInterval: `${WIKI.models.storage.syncIntervalFor(req.params.siteId)}m`,
        directAccessFallback: WIKI.models.storage.directAccessFallbackFor(req.params.siteId),
        /*
          Masked here rather than in the model: the targets the model hands out are the ones the
          storage modules read their credentials from, so this is the last point at which a secret
          can be taken out without taking it away from the code that needs it.

          A prop declared `sensitive` is write-only. The mask comes back with the rest of the
          configuration on a save and is understood as "unchanged" — see `buildConfig`.
        */
        targets: (await WIKI.models.storage.getSiteTargets(req.params.siteId)).map((target) => ({
          ...target,
          config: maskSensitiveProps(target.props, target.config)
        }))
      }
    }
  )

  /**
   * GET SITE STORAGE STATUS
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/storage/status',
    {
      config: {
        // -> Deliberately not `manage:system`, unlike the rest of this file: this answers a status
        //    light in the admin sidebar, which anybody who can see the storage section at all needs,
        //    and it carries none of the configuration that makes the rest of these privileged
        permissions: ['manage:sites']
      },
      schema: {
        summary: "Get the health of a site's storage targets",
        description:
          'How each enabled target is behaving, and nothing else - no configuration and no credentials. A target that is disabled is absent rather than reported: it is not being asked to do anything, so what it last recorded is history. Answered from the same cache the upload path resolves through, so it is current without costing a query.',
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
            description: 'Health of the site storage targets',
            type: 'object',
            properties: {
              targets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    isEnabled: { type: 'boolean' },
                    state: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          enum: [...STORAGE_TARGET_STATUSES]
                        }
                      }
                    }
                  }
                }
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
      return { targets: await WIKI.models.storage.healthFor(req.params.siteId) }
    }
  )

  /**
   * UPDATE SITE STORAGE CONFIGURATION
   */
  app.put<{
    Params: { siteId: string }
    Body: StorageSiteConfigInput & { targets?: StorageTargetInput[] }
  }>(
    '/sites/:siteId/storage',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update the storage configuration of a site',
        description:
          'Only the targets listed are affected, and within each of them only the fields provided. Everything is validated before any of it is written, so a rejected request changes nothing. Changing the path layout moves nothing: content already stored stays where the previous layout put it, and a target holding it has export and import actions for putting that right.',
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
            sitePrefix: {
              type: 'boolean',
              description: 'Prepend the site id to every path. Applies to every target of the site.'
            },
            localePrefix: {
              type: 'boolean',
              description:
                'Prepend the locale to every path. Applies to every target of the site. Turning it off leaves every locale but the primary one without a path to be stored under.'
            },
            syncInterval: {
              type: 'string',
              maxLength: 32,
              description:
                'A whole number of minutes or hours, such as `5m` or `1h`. The scheduler ticks once a minute, so this is honoured to the minute and cannot be shorter than one.'
            },
            directAccessFallback: {
              type: 'string',
              enum: [...STORAGE_DIRECT_ACCESS_FALLBACKS],
              description: 'What to do when a direct link cannot be signed.'
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
