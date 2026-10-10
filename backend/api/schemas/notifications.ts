import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * NOTIFICATION - One entry in somebody's inbox
   */
  app.addSchema({
    $id: 'Notification',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      category: {
        type: 'string',
        description:
          'What kind of notification this is: `watchedPage`, `watchedPageComment`, `commentReply`, `mention`, `reviewRequested`, `pageCreated` or `pageDeleted`.'
      },
      variant: {
        type: 'string',
        description:
          'What happened, within the category — `edited`, `moved`, `published`, `unpublished`, `scheduled`, `deleted`, `new`, `updated`, `created`, `restored`. The latest one, for an entry that absorbed several events.'
      },
      count: {
        type: 'integer',
        description:
          'How many events this entry stands for. A page saved ten times while nobody looked is one entry with a count of ten.'
      },
      pageId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'The page it is about, while that page exists.'
      },
      commentId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'The comment it is about, while that comment exists.'
      },
      actorId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description:
          'Who did it, while their account exists. Null for a guest, whose name is in `data.actorName`.'
      },
      data: {
        type: 'object',
        additionalProperties: true,
        description:
          'A snapshot of what the entry is about, taken when it happened, so that it can still be drawn after the page has moved or gone: `page` (`id`, `title`, `path`, `locale`), `actorName`, `variants` (every variant absorbed), `previousPath`, `submissionId`, `origin` (`import` or `bulk` when nobody did it by hand), and `excerpt` — a comment’s first lines, present only while the comment exists. A comment on a password-protected page this session has not unlocked carries `excerptWithheld: true` instead of `excerpt`.'
      },
      isRead: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the entry last absorbed an event, which is what the inbox sorts by.'
      }
    }
  })

  /**
   * NOTIFICATION PREFERENCE - One category, as Profile → Notifications offers it
   */
  app.addSchema({
    $id: 'NotificationPreference',
    type: 'object',
    properties: {
      key: { type: 'string' },
      section: {
        type: 'string',
        enum: ['watching', 'discussions', 'reviews', 'everything'],
        description: 'The heading the Profile screen lists it under.'
      },
      inApp: { type: 'boolean' },
      email: { type: 'boolean' },
      defaults: {
        type: 'object',
        properties: {
          inApp: { type: 'boolean' },
          email: { type: 'boolean' }
        }
      }
    }
  })

  /**
   * NOTIFICATION SETTINGS - The instance-wide settings, used both ways
   */
  app.addSchema({
    $id: 'NotificationSettings',
    type: 'object',
    properties: {
      retentionDays: {
        type: 'integer',
        minimum: 1,
        maximum: 3650,
        description: 'How many days a notification is kept, read or not.'
      },
      emailDelay: {
        type: 'string',
        maxLength: 16,
        description:
          'How long a notification waits before it is emailed, e.g. `3m`. Whatever else happens to the same thing in the meantime goes into the same email; once emailed, an entry is not emailed about again until it has been read. At most an hour.'
      },
      mailBatchSize: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        description: 'How many people one run of the mail task sends to.'
      }
    }
  })

  /**
   * NOTIFICATION STATUS - How delivery is doing, for the admin screen
   */
  app.addSchema({
    $id: 'NotificationStatus',
    type: 'object',
    properties: {
      pendingEvents: {
        type: 'integer',
        description:
          'Events not yet turned into notifications. Anything beyond a handful for long means the fan-out is falling behind.'
      },
      oldestPendingEventAt: { type: 'string', format: 'date-time', nullable: true },
      emailsPending: { type: 'integer', description: 'Emails waiting to be sent.' },
      emailsSent24h: { type: 'integer' },
      emailsFailed24h: {
        type: 'integer',
        description: 'Emails given up on after repeated failures to hand them to the relay.'
      },
      isMailConfigured: { type: 'boolean' },
      warnings: {
        type: 'array',
        items: { type: 'string', enum: ['plainHttp', 'wildcardHostname'] },
        description:
          '`plainHttp`: the base URL links are built with is not HTTPS, which one-click unsubscribe needs to be honoured by Gmail. `wildcardHostname`: a site answers to any hostname and no base URL is set, so its emails have no address to link to and are not sent.'
      }
    }
  })
}
