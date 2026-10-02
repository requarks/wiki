import { createHash } from 'node:crypto'
import { audit } from '../helpers/audit.ts'
import { NOTIFICATION_CATEGORY_KEYS } from '../notifications/index.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * The account an inbox or a set of preferences belongs to, or a refusal.
 *
 * Every route here but the unsubscribe pair is about the caller's own rows, so being signed in is the
 * whole of the check — there is no permission for reading one's own inbox, and an API key, which acts
 * for groups rather than for a person, has no inbox to read.
 */
function ownerOf(req: FastifyRequest, reply: FastifyReply): string | null {
  const userId = req.session?.authenticated ? req.session.user?.id : null
  if (!userId) {
    reply.unauthorized('Notifications belong to a signed-in user.')
    return null
  }
  return userId
}

/**
 * The site an inbox is read on, or a refusal. Nothing is shown on a site with notifications switched
 * off, which is the same as having none.
 */
function siteOf(req: FastifyRequest<{ Params: { siteId: string } }>, reply: FastifyReply) {
  if (!WIKI.sites[req.params.siteId]) {
    reply.notFound('This site does not exist.')
    return null
  }
  return req.params.siteId
}

const siteParams = {
  type: 'object',
  properties: { siteId: { type: 'string', format: 'uuid' } },
  required: ['siteId']
}

const preferencesResponse = {
  type: 'object',
  properties: {
    preferences: { type: 'array', items: { $ref: 'NotificationPreference#' } },
    emailAvailable: {
      type: 'boolean',
      description:
        'Whether this instance can send email at all. Without it, every email choice is stored but has no effect.'
    }
  }
}

/**
 * Notifications API Routes
 *
 * The inbox and its badge, the preferences behind Profile → Notifications, the one-click unsubscribe
 * a notification email carries, and the instance settings of Admin → Notifications. What becomes a
 * notification and who receives it is decided elsewhere — `models/notifications.ts` and the worker
 * tasks it queues.
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST NOTIFICATIONS
   */
  app.get<{
    Params: { siteId: string }
    Querystring: { cursor?: string; unread?: boolean; limit?: number }
  }>(
    '/sites/:siteId/notifications',
    {
      // -> No route-level permissions: the caller's own rows, and the session is the whole check
      schema: {
        summary: "List the caller's notifications",
        description:
          'Newest activity first: an entry that absorbs another event moves back to the top. Includes the entries of this site and those that belong to no site.\n\nKeyset-paginated: pass the `next` of one page as the `cursor` of the next.',
        tags: ['Notifications'],
        params: siteParams,
        querystring: {
          type: 'object',
          properties: {
            cursor: { type: 'string', maxLength: 128 },
            unread: { type: 'boolean', description: 'Only entries not yet read.' },
            limit: { type: 'integer', minimum: 1, maximum: 100 }
          }
        },
        response: {
          200: {
            description: 'One page of the inbox',
            type: 'object',
            properties: {
              entries: { type: 'array', items: { $ref: 'Notification#' } },
              next: { type: 'string', nullable: true }
            }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const userId = ownerOf(req, reply)
      const siteId = userId && siteOf(req, reply)
      if (!userId || !siteId) {
        return reply
      }
      return WIKI.models.notifications.list(userId, siteId, req.query)
    }
  )

  /**
   * NOTIFICATIONS SUMMARY
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/notifications/summary',
    {
      // -> No route-level permissions: see above
      schema: {
        summary: "Count the caller's unread notifications",
        description:
          'What the badge polls. `unread` stops counting at 100. Answers with an `ETag` and `304 Not Modified` when nothing has changed, so a poll that finds nothing new costs no body.',
        tags: ['Notifications'],
        params: siteParams,
        response: {
          200: {
            description: 'The unread count, and when the inbox last changed',
            type: 'object',
            properties: {
              unread: { type: 'integer' },
              latestAt: { type: 'string', format: 'date-time', nullable: true }
            }
          },
          304: { description: 'Nothing has changed since the ETag sent', type: 'null' }
        }
      }
    },
    async (req, reply) => {
      const userId = ownerOf(req, reply)
      const siteId = userId && siteOf(req, reply)
      if (!userId || !siteId) {
        return reply
      }
      const summary = await WIKI.models.notifications.summary(userId, siteId)
      // -> Built from the answer AND who asked: the same URL answers differently for each person, and a
      //    tag naming only the count would let one session revalidate against another's
      const etag = `"${createHash('sha1')
        .update(`${userId}|${summary.unread}|${summary.latestAt ?? ''}`)
        .digest('base64url')}"`
      reply.header('Cache-Control', 'private, no-cache')
      reply.header('ETag', etag)
      if (req.headers['if-none-match'] === etag) {
        return reply.code(304).send()
      }
      return summary
    }
  )

  /**
   * MARK NOTIFICATIONS READ
   */
  app.put<{
    Params: { siteId: string }
    Body: { ids?: string[]; pageId?: string; categories?: string[] }
  }>(
    '/sites/:siteId/notifications/read',
    {
      // -> No route-level permissions: see above
      schema: {
        summary: 'Mark notifications read',
        description:
          'Everything, when the body names nothing. Otherwise the entries matching every filter given: particular entries by `ids`, or everything about one page by `pageId` — narrowed by `categories`, which is how opening a page clears what was said about its content while leaving its discussion for the Talk tab.\n\nAn entry read before its email has gone cancels the email.',
        tags: ['Notifications'],
        params: siteParams,
        body: {
          type: 'object',
          properties: {
            ids: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 500 },
            pageId: { type: 'string', format: 'uuid' },
            categories: { type: 'array', items: { type: 'string', maxLength: 64 }, maxItems: 20 }
          }
        },
        response: {
          200: {
            description: 'How many entries were marked read',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              updated: { type: 'integer' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = ownerOf(req, reply)
      const siteId = userId && siteOf(req, reply)
      if (!userId || !siteId) {
        return reply
      }
      /*
        Not audited. Marking one's own inbox read is bookkeeping, and a row per click would bury
        everything the audit log is for — the reason page views are not recorded either.
      */
      const updated = await WIKI.models.notifications.markRead(userId, siteId, req.body ?? {})
      return { ok: true, updated }
    }
  )

  /**
   * DISMISS A NOTIFICATION
   */
  app.delete<{ Params: { siteId: string; notificationId: string } }>(
    '/sites/:siteId/notifications/:notificationId',
    {
      // -> No route-level permissions: see above
      schema: {
        summary: 'Dismiss a notification',
        description:
          'Removes one entry from the caller’s inbox. Not audited, as marking read is not.',
        tags: ['Notifications'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            notificationId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'notificationId']
        },
        response: {
          200: {
            description: 'Dismissed',
            type: 'object',
            properties: { ok: { type: 'boolean' } }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = ownerOf(req, reply)
      const siteId = userId && siteOf(req, reply)
      if (!userId || !siteId) {
        return reply
      }
      if (!(await WIKI.models.notifications.dismiss(userId, siteId, req.params.notificationId))) {
        return reply.notFound('This notification does not exist.')
      }
      return { ok: true }
    }
  )

  /**
   * GET OWN NOTIFICATION PREFERENCES
   */
  app.get(
    '/users/profile/notifications',
    {
      // -> No route-level permissions: session-scoped like the rest of `/users/profile`
      schema: {
        summary: "Get the logged in user's notification preferences",
        description:
          'Every category the caller is offered, with the channel choices in effect — their own where they made one, the category default where they did not. One set for every site.',
        tags: ['Notifications'],
        response: { 200: preferencesResponse }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const userId = ownerOf(req, reply)
      if (!userId) {
        return reply
      }
      return {
        preferences: await WIKI.models.notifications.getPrefs(userId, {
          permissions: req.session.permissions ?? []
        }),
        emailAvailable: WIKI.models.mail.isConfigured
      }
    }
  )

  /**
   * UPDATE OWN NOTIFICATION PREFERENCES
   */
  app.put<{ Body: { preferences: Record<string, { inApp?: boolean; email?: boolean }> } }>(
    '/users/profile/notifications',
    {
      // -> No route-level permissions: see above
      schema: {
        summary: "Update the logged in user's notification preferences",
        description:
          'Keyed by category. A category or a channel left out is left as it is, and a category the caller is not offered is ignored.',
        tags: ['Notifications'],
        body: {
          type: 'object',
          required: ['preferences'],
          properties: {
            preferences: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  inApp: { type: 'boolean' },
                  email: { type: 'boolean' }
                }
              }
            }
          }
        },
        response: { 200: preferencesResponse }
      }
    },
    async (req, reply) => {
      const userId = ownerOf(req, reply)
      if (!userId) {
        return reply
      }
      const actor = { permissions: req.session.permissions ?? [] }
      const changed = await WIKI.models.notifications.setPrefs(userId, actor, req.body.preferences)
      if (changed.length > 0) {
        await audit(req, 'profile', 'updateNotificationPrefs', { categories: changed.sort() })
      }
      return {
        preferences: await WIKI.models.notifications.getPrefs(userId, actor),
        emailAvailable: WIKI.models.mail.isConfigured
      }
    }
  )

  /**
   * ONE-CLICK UNSUBSCRIBE (RFC 8058)
   */
  app.post<{
    Querystring: { t?: string }
    Body: { t?: string; scope?: 'token' | 'all'; 'List-Unsubscribe'?: string }
  }>(
    '/notifications/unsubscribe',
    {
      config: {
        publicAccess: true
      },
      schema: {
        summary: 'Unsubscribe from notification email',
        description:
          'What a mail client posts when somebody presses its own unsubscribe button: the URL in the `List-Unsubscribe` header, with `List-Unsubscribe=One-Click` as a form body (RFC 8058). Needs no session — the token in the URL says who, and all it can do is turn email off for them.\n\nTurns off EMAIL for the categories the mail was about, or for every category with `scope=all`, and cancels whatever email was waiting for them. In-app notifications carry on.',
        tags: ['Notifications'],
        consumes: ['application/x-www-form-urlencoded', 'application/json'],
        querystring: {
          type: 'object',
          properties: { t: { type: 'string', maxLength: 2048 } }
        },
        body: {
          type: 'object',
          additionalProperties: true,
          properties: {
            t: { type: 'string', maxLength: 2048, description: 'The token, when not in the URL.' },
            scope: { type: 'string', enum: ['token', 'all'] }
          }
        },
        response: {
          200: {
            description: 'Unsubscribed',
            type: 'object',
            properties: { ok: { type: 'boolean' } }
          }
        }
      }
    },
    async (req, reply) => {
      const scope = req.body?.scope === 'all' ? 'all' : 'token'
      const claim = await WIKI.models.notifications.unsubscribe(req.query.t ?? req.body?.t, scope)
      if (!claim) {
        // -> Says nothing about which part was wrong
        return reply.badRequest('This unsubscribe link is not valid.')
      }
      /*
        Recorded as the account the token was issued to, like the auth events that record themselves:
        there is no session, and the token is the only thing that identifies anybody.
      */
      const user = await WIKI.models.users.getById(claim.userId)
      await WIKI.models.auditLog.record({
        kind: 'profile',
        action: 'unsubscribeNotifications',
        actor: {
          id: user?.id ?? null,
          name: user?.name ?? null,
          email: user?.email ?? null,
          ip: req.ip
        },
        meta: { scope, categories: claim.categories }
      })
      return { ok: true }
    }
  )

  /**
   * UNSUBSCRIBE LINK, OPENED
   */
  app.get<{ Querystring: { t?: string } }>(
    '/notifications/unsubscribe',
    {
      config: {
        publicAccess: true
      },
      schema: {
        summary: 'Open an unsubscribe link',
        description:
          'Changes nothing, and sends the browser to the page that asks first. Mail scanners fetch every link in a message, so a GET that acted would unsubscribe people who never asked.',
        tags: ['Notifications'],
        querystring: {
          type: 'object',
          properties: { t: { type: 'string', maxLength: 2048 } }
        },
        response: {
          302: { description: 'Redirect to the unsubscribe page', type: 'null' }
        }
      }
    },
    async (req, reply) => {
      return reply.redirect(`/_unsubscribe?t=${encodeURIComponent(req.query.t ?? '')}`)
    }
  )

  /**
   * DESCRIBE AN UNSUBSCRIBE LINK
   */
  app.get<{ Querystring: { t?: string } }>(
    '/notifications/unsubscribe/info',
    {
      config: {
        publicAccess: true
      },
      schema: {
        summary: 'Describe an unsubscribe link',
        description:
          'Which categories a link would unsubscribe from, for the page that asks before it does. Says nothing about whose it is.',
        tags: ['Notifications'],
        querystring: {
          type: 'object',
          properties: { t: { type: 'string', maxLength: 2048 } }
        },
        response: {
          200: {
            description: 'What the link would do',
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              categories: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    },
    async (req) => {
      const claim = WIKI.models.notifications.readToken(req.query.t)
      return { valid: Boolean(claim), categories: claim?.categories ?? [] }
    }
  )

  /**
   * GET NOTIFICATION SETTINGS
   */
  app.get(
    '/system/notifications',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get the notification settings and delivery status',
        description:
          'The instance-wide settings — retention, the email delay, the mail batch size — and how delivery is doing: the backlog of events still to be turned into notifications, and the emails of the last day.',
        tags: ['Notifications'],
        response: {
          200: {
            description: 'Settings and status',
            type: 'object',
            properties: {
              settings: { $ref: 'NotificationSettings#' },
              status: { $ref: 'NotificationStatus#' },
              categories: {
                type: 'array',
                items: { type: 'string' },
                description: 'Every category there is.'
              }
            }
          }
        }
      }
    },
    async (_req, reply) => {
      reply.preventCache()
      return {
        settings: WIKI.models.notifications.getConfig(),
        status: await WIKI.models.notifications.status(),
        categories: NOTIFICATION_CATEGORY_KEYS
      }
    }
  )

  /**
   * UPDATE NOTIFICATION SETTINGS
   */
  app.put<{ Body: Record<string, any> }>(
    '/system/notifications',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update the notification settings',
        description:
          'Accepts any subset of the fields, and applies at once on every instance. A change to the email delay applies to notifications written from then on.',
        tags: ['Notifications'],
        body: { $ref: 'NotificationSettings#' },
        response: {
          200: {
            description: 'Saved',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const patch: Record<string, any> = {}
      for (const field of ['retentionDays', 'emailDelay', 'mailBatchSize']) {
        if (req.body?.[field] !== undefined) {
          patch[field] = req.body[field]
        }
      }
      if (Object.keys(patch).length < 1) {
        return reply.badRequest('No valid notification setting was provided.')
      }
      const invalid = WIKI.models.notifications.validate(patch)
      if (invalid) {
        return reply.badRequest(invalid)
      }
      if (!(await WIKI.models.notifications.updateConfig(patch))) {
        return reply.internalServerError('Failed to save the notification settings.')
      }
      // -> Fields rather than values, as the other configuration routes do
      await audit(req, 'admin', 'updateNotificationSettings', {
        fields: Object.keys(patch).sort()
      })
      return { ok: true, message: 'Notification settings saved successfully.' }
    }
  )
}

export default routes
