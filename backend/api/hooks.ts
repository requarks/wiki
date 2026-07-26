import type { FastifyInstance } from 'fastify'
import { EMITTED_EVENTS, HOOK_EVENTS } from '../models/hooks.ts'

interface HookBody {
  name?: string
  events?: string[]
  url?: string
  includeMetadata?: boolean
  includeContent?: boolean
  acceptUntrusted?: boolean
  authHeader?: string
}

/**
 * Reject what the admin area's own validation rejects, so the API is not the looser of the two
 */
function invalidReason(body: HookBody, { partial }: { partial: boolean }): string | null {
  if (body.name !== undefined && !/^[^<>"]+$/.test(body.name)) {
    return 'The webhook name contains invalid characters.'
  }
  if (body.url !== undefined) {
    let parsed: URL
    try {
      parsed = new URL(body.url)
    } catch {
      return 'The URL is not valid.'
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'The URL must be an http or https address.'
    }
  }
  if (!partial && (body.events?.length ?? 0) < 1) {
    return 'At least one event is required.'
  }
  if (body.events !== undefined && body.events.length < 1) {
    return 'At least one event is required.'
  }
  return null
}

/**
 * Webhooks API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST WEBHOOKS
   */
  app.get(
    '/',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List all webhooks',
        tags: ['Webhooks'],
        response: {
          200: {
            description: 'List of webhooks',
            type: 'array',
            items: { $ref: 'Hook#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.hooks.getHooks()
    }
  )

  /**
   * LIST AVAILABLE EVENTS
   */
  app.get(
    '/events',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the events a webhook can subscribe to',
        description:
          'Only `user:join` and `user:login` are emitted at the moment. Pages, assets, comments and logout are not implemented yet, so a subscription to those is stored but never triggered.',
        tags: ['Webhooks'],
        response: {
          200: {
            description: 'List of event keys',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: {
                  type: 'string'
                },
                isEmitted: {
                  type: 'boolean',
                  description: 'Whether anything in the server currently emits this event.'
                }
              }
            }
          }
        }
      }
    },
    async () => {
      return HOOK_EVENTS.map((key) => ({ key, isEmitted: EMITTED_EVENTS.includes(key) }))
    }
  )

  /**
   * GET WEBHOOK
   */
  app.get<{ Params: { hookId: string } }>(
    '/:hookId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get a single webhook',
        tags: ['Webhooks'],
        params: {
          type: 'object',
          properties: {
            hookId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['hookId']
        },
        response: {
          200: { $ref: 'Hook#' }
        }
      }
    },
    async (req, reply) => {
      const hook = await WIKI.models.hooks.getHookById(req.params.hookId)
      if (!hook) {
        return reply.notFound('Webhook does not exist.')
      }
      return hook
    }
  )

  /**
   * CREATE WEBHOOK
   */
  app.post<{ Body: HookBody }>(
    '/',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Create a new webhook',
        tags: ['Webhooks'],
        // -> The same shape as an update, with the three fields a webhook cannot exist without
        body: {
          allOf: [{ $ref: 'HookInput#' }, { required: ['name', 'events', 'url'] }]
        },
        response: {
          200: {
            description: 'Webhook created successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              id: {
                type: 'string',
                format: 'uuid'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const invalid = invalidReason(req.body, { partial: false })
      if (invalid) {
        return reply.badRequest(invalid)
      }

      const id = await WIKI.models.hooks.createHook({
        name: req.body.name!,
        events: req.body.events!,
        url: req.body.url!,
        includeMetadata: req.body.includeMetadata,
        includeContent: req.body.includeContent,
        acceptUntrusted: req.body.acceptUntrusted,
        authHeader: req.body.authHeader
      })

      return {
        ok: true,
        message: 'Webhook created successfully.',
        id
      }
    }
  )

  /**
   * UPDATE WEBHOOK
   */
  app.put<{ Params: { hookId: string }; Body: HookBody }>(
    '/:hookId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update a webhook',
        description:
          'Accepts any subset of the fields. Changing the URL, the events or the authentication header resets the webhook to pending, since the last outcome no longer describes the new configuration.',
        tags: ['Webhooks'],
        params: {
          type: 'object',
          properties: {
            hookId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['hookId']
        },
        body: { $ref: 'HookInput#' },
        response: {
          200: {
            description: 'Webhook updated successfully',
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
      if (!(await WIKI.models.hooks.getHookById(req.params.hookId))) {
        return reply.notFound('Webhook does not exist.')
      }
      const invalid = invalidReason(req.body, { partial: true })
      if (invalid) {
        return reply.badRequest(invalid)
      }
      const patch: Record<string, any> = {}
      for (const field of [
        'name',
        'events',
        'url',
        'includeMetadata',
        'includeContent',
        'acceptUntrusted',
        'authHeader'
      ] as const) {
        if (req.body[field] !== undefined) {
          patch[field] = req.body[field]
        }
      }
      if (Object.keys(patch).length < 1) {
        return reply.badRequest('No webhook fields provided to update.')
      }

      await WIKI.models.hooks.updateHook(req.params.hookId, patch)

      return {
        ok: true,
        message: 'Webhook updated successfully.'
      }
    }
  )

  /**
   * DELETE WEBHOOK
   */
  app.delete<{ Params: { hookId: string } }>(
    '/:hookId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Delete a webhook',
        tags: ['Webhooks'],
        params: {
          type: 'object',
          properties: {
            hookId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['hookId']
        },
        response: {
          204: {
            description: 'Webhook deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      if (!(await WIKI.models.hooks.deleteHook(req.params.hookId))) {
        return reply.notFound('Webhook does not exist.')
      }
      return reply.code(204).send()
    }
  )
}

export default routes
