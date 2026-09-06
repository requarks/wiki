import type { FastifyInstance } from 'fastify'
import { AUDIT_ACTION_KEYS, AUDIT_KINDS, MIN_RETENTION_DAYS } from '../../models/auditLog.ts'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * AUDIT ENTRY - One recorded action
   */
  app.addSchema({
    $id: 'AuditEntry',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      ts: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      },
      kind: {
        $ref: 'AuditKind#'
      },
      action: {
        type: 'string',
        description:
          'What was done, camelCase. A translation key rather than a sentence — the interface looks it up as `admin.audit.actions.<action>`.'
      },
      clientIP: {
        type: 'string',
        description: 'Address the request came from.'
      },
      userId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description:
          'The account that acted, while it exists. Null once it is deleted, and null for an action nobody was signed in for — the name and email on `meta.actor` are what the entry is read by then.'
      },
      meta: {
        type: 'object',
        additionalProperties: true,
        description:
          'What the action touched, plus an `actor` block holding the email, display name and address the requester had at the time. Never carries a secret, and never the content of a change — a page edit records the `pageHistory` version its change produced instead.'
      }
    }
  })

  /**
   * AUDIT KIND - The areas an action can belong to
   */
  app.addSchema({
    $id: 'AuditKind',
    type: 'string',
    enum: [...AUDIT_KINDS]
  })

  /**
   * AUDIT ACTION - Every action key the wiki records
   */
  app.addSchema({
    $id: 'AuditAction',
    type: 'string',
    enum: AUDIT_ACTION_KEYS
  })

  /**
   * AUDIT CONFIG - How long entries are kept
   */
  app.addSchema({
    $id: 'AuditConfig',
    type: 'object',
    properties: {
      retentionDays: {
        type: 'integer',
        minimum: 0,
        description: `How many days of log to keep. Entries older than this are deleted daily by the \`purgeAuditLog\` task. Zero keeps everything for ever, and anything else is at least ${MIN_RETENTION_DAYS} — see the PUT for why there is a floor.`
      },
      total: {
        type: 'integer',
        description: 'How many entries the log currently holds.'
      },
      oldestEntry: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When the oldest entry was recorded, or null when the log is empty.'
      }
    }
  })
}
