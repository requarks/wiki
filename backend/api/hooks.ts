import { audit } from '../helpers/audit.ts'
import { SENSITIVE_MASK } from '../helpers/common.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { EMITTED_EVENTS, HOOK_EVENTS } from '../models/hooks.ts'

/** Whether this caller may change webhooks, as opposed to only reading them. */
function mayManage(req: FastifyRequest): boolean {
  const permissions = req.apiKey?.permissions ?? req.session?.permissions ?? []
  return permissions.includes('manage:webhooks') || permissions.includes('manage:system')
}

/**
 * A webhook as this caller may read it.
 *
 * `authHeader` is sent verbatim as the `Authorization` header of every delivery, so it is a
 * credential for somebody else's service rather than a setting -- and `read:webhooks` exists to let
 * somebody see what this wiki is wired to without handing them the keys to it. Masked the way a
 * module's `sensitive` prop is, and for the reason given there: the value would otherwise end up in
 * a browser, a cache and a screen share.
 *
 * Left intact for whoever may edit the webhook, since the field is theirs to read back and correct.
 * That asymmetry is the whole point of the read-only rung.
 */
function forReader(req: FastifyRequest, hook: Record<string, any>): Record<string, any> {
  if (mayManage(req)) {
    return hook
  }
  return { ...hook, authHeader: hook.authHeader ? SENSITIVE_MASK : hook.authHeader }
}

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
        permissions: ['read:webhooks', 'manage:webhooks']
      },
      schema: {
        summary: 'List all webhooks',
        description:
          'Every webhook and its settings. `authHeader` reads as a fixed mask for a caller who may not change webhooks -- it is a credential for the service at the other end, not a setting to be read.',
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
    async (req) => {
      return (await WIKI.models.hooks.getHooks()).map((hook) => forReader(req, hook))
    }
  )

  /**
   * LIST AVAILABLE EVENTS
   */
  app.get(
    '/events',
    {
      config: {
        permissions: ['read:webhooks', 'manage:webhooks']
      },
      schema: {
        summary: 'List the events a webhook can subscribe to',
        description:
          'Only the `user:*` events are emitted at the moment. Pages, assets and comments are not implemented yet, so a subscription to those is stored but never triggered.',
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
        permissions: ['read:webhooks', 'manage:webhooks']
      },
      schema: {
        summary: 'Get a single webhook',
        description:
          'See the listing for how `authHeader` reads.',
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
      return forReader(req, hook)
    }
  )

  /**
   * CREATE WEBHOOK
   */
  app.post<{ Body: HookBody }>(
    '/',
    {
      config: {
        permissions: ['manage:webhooks']
      },
      schema: {
        summary: 'Create a new webhook',
        tags: ['Webhooks'],
        // -> The same shape as an update, with the three fields a webhook cannot exist without
        body: {
          allOf: [{ $ref: 'HookInput#' }, { type: 'object', required: ['name', 'events', 'url'] }]
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

      // -> No `authHeader`: a webhook's auth header is a credential for the endpoint it calls
      await audit(req, 'admin', 'createHook', {
        hookId: id,
        name: req.body.name,
        url: req.body.url,
        events: req.body.events
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
        permissions: ['manage:webhooks']
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
      /*
        The mask means "unchanged", exactly as it does for a module's sensitive props: a client that
        read a masked `authHeader` and posts the whole webhook back must not store a row of dots as
        the credential. An empty string is not the mask and does clear it, which is how the header is
        removed.
      */
      if (patch.authHeader === SENSITIVE_MASK) {
        delete patch.authHeader
      }
      if (Object.keys(patch).length < 1) {
        return reply.badRequest('No webhook fields provided to update.')
      }

      await WIKI.models.hooks.updateHook(req.params.hookId, patch)

      await audit(req, 'admin', 'updateHook', {
        hookId: req.params.hookId,
        name: patch.name,
        url: patch.url,
        changedFields: Object.keys(patch)
      })

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
        permissions: ['manage:webhooks']
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

      await audit(req, 'admin', 'deleteHook', { hookId: req.params.hookId })

      return reply.code(204).send()
    }
  )
}

export default routes
