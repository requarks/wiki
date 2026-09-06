import { Readable } from 'node:stream'
import { validate as uuidValidate } from 'uuid'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { audit } from '../helpers/audit.ts'
import { AUDIT_ACTIONS, AUDIT_KINDS, MIN_RETENTION_DAYS } from '../models/auditLog.ts'

/** Most rows one request may ask for, so that a filter matching everything cannot be a denial of service. */
const MAX_PAGE_SIZE = 100

/** Most accounts one request may name, so the `userId` list cannot be an unbounded `IN`. */
const MAX_USER_FILTER = 50

/** Comma-separated query lists, which is how the browser sends a multi-valued filter here. */
function splitList(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map((v) => v.trim())
      .filter(Boolean) ?? []
  )
}

/** The filter half of the querystring, shared by the list and the export. */
interface AuditQuery {
  userId?: string
  kind?: string
  action?: string
  from?: string
  to?: string
}

/**
 * The filters as the model takes them, or the refusal to send back.
 *
 * The user IDs are validated rather than passed through: they go into an `IN` against a uuid column,
 * so one malformed value makes postgres raise and the request fail as a 500 rather than as the bad
 * request it is.
 */
function filtersFrom(
  query: AuditQuery,
  reply: FastifyReply
): { userIds: string[]; kind?: string; action?: string; from?: string; to?: string } | null {
  const userIds = splitList(query.userId)
  if (userIds.length > MAX_USER_FILTER) {
    reply.badRequest(`At most ${MAX_USER_FILTER} users can be filtered for at once.`)
    return null
  }
  if (userIds.some((id) => !uuidValidate(id))) {
    reply.badRequest('The userId filter must be one user ID, or several separated by commas.')
    return null
  }
  return { userIds, kind: query.kind, action: query.action, from: query.from, to: query.to }
}

/** The filter querystring both routes declare. */
const filterProperties = {
  userId: {
    type: 'string',
    description:
      'Only entries these accounts made — one ID, or several comma-separated, OR-ed against each other. At most 50.\n\nAn account that has since been deleted can no longer be filtered for: its entries have no `userId` left. The name and email it had are still on `meta.actor`.'
  },
  kind: { $ref: 'AuditKind#' },
  action: { $ref: 'AuditAction#' },
  from: {
    type: 'string',
    format: 'date-time',
    description: 'Inclusive lower bound on the timestamp, RFC 3339.'
  },
  to: {
    type: 'string',
    format: 'date-time',
    description: 'Inclusive upper bound on the timestamp, RFC 3339.'
  }
} as const

/**
 * Audit Log API Routes
 *
 * Read-only from the outside: nothing here writes an entry. Entries are written by `helpers/audit.ts`
 * as a side effect of the routes that do the work, which is what keeps the log a record of what
 * happened rather than a table anybody can post to.
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST AUDIT ENTRIES
   */
  app.get<{
    Querystring: {
      userId?: string
      kind?: string
      action?: string
      from?: string
      to?: string
      page?: number
      limit?: number
    }
  }>(
    '/',
    {
      config: {
        permissions: ['read:audit']
      },
      schema: {
        summary: 'List audit log entries',
        description:
          'Newest first, one page at a time. Every filter is optional and they are AND-ed together.\n\nWhat is recorded: every action that CHANGES something, plus successful logins. Reads are not — page views would outnumber everything else and bury the log — and neither are failed login attempts, which would otherwise let anybody outside fill this table on demand. Actions taken by the scheduler are absent by construction: an entry is only ever written from a request.',
        tags: ['Audit Log'],
        querystring: {
          type: 'object',
          properties: {
            ...filterProperties,
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: 25 }
          }
        },
        response: {
          200: {
            description: 'One page of audit entries',
            type: 'object',
            properties: {
              total: {
                type: 'integer',
                description: 'How many entries match the filters, across every page.'
              },
              entries: {
                type: 'array',
                items: { $ref: 'AuditEntry#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const filters = filtersFrom(req.query, reply)
      if (!filters) {
        return reply
      }
      return WIKI.models.auditLog.list(filters, req.query.page ?? 1, req.query.limit ?? 25)
    }
  )

  /**
   * EXPORT AUDIT ENTRIES
   */
  app.get<{ Querystring: AuditQuery }>(
    '/export',
    {
      config: {
        permissions: ['read:audit']
      },
      schema: {
        summary: 'Download the audit log as JSONL',
        description:
          'Every entry matching the filters, newest first — not just the page on screen — as newline-delimited JSON: one entry per line, the same shape the list returns. A format that streams, so a year of history is a download rather than a request that has to be held in memory at both ends, and that `jq` and every log pipeline read without unwrapping an envelope first.\n\nThe export itself is recorded in the log, which is the one read that is: taking a copy of who did what is worth knowing about.',
        tags: ['Audit Log'],
        querystring: {
          type: 'object',
          properties: filterProperties
        },
        response: {
          200: {
            description: 'The matching entries, one JSON object per line',
            content: {
              'application/x-ndjson': {
                schema: { type: 'string' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const filters = filtersFrom(req.query, reply)
      if (!filters) {
        return reply
      }

      /*
        Recorded BEFORE the stream, deliberately. Everywhere else an entry is written once the work
        succeeded, but a download has no moment of success the server sees — the connection can drop
        halfway and the rows already sent are still gone. What is worth recording is that the export
        was asked for and authorized.
      */
      await audit(req, 'admin', 'exportAuditLog', {
        filters: {
          userIds: filters.userIds,
          kind: filters.kind ?? null,
          action: filters.action ?? null,
          from: filters.from ?? null,
          to: filters.to ?? null
        }
      })

      const stamp = Temporal.Now.instant().toString({ smallestUnit: 'second' }).replace(/[:]/g, '-')
      reply.header('Content-Type', 'application/x-ndjson; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="audit-log-${stamp}.jsonl"`)
      reply.preventCache()

      // -> The entries this request just wrote are in the export too, which is correct: it is the log
      //    as it stands at the moment it was asked for
      const entries = WIKI.models.auditLog.stream(filters)
      return reply.send(
        Readable.from(
          (async function* () {
            for await (const entry of entries) {
              yield `${JSON.stringify(entry)}\n`
            }
          })()
        )
      )
    }
  )

  /**
   * LIST AUDIT ACTIONS
   */
  app.get(
    '/actions',
    {
      config: {
        permissions: ['read:audit']
      },
      schema: {
        summary: 'List every action the wiki records, by area',
        description:
          'What the filter offers, and the full set of translation keys: each action is shown as `admin.audit.actions.<action>`. Served from the code rather than from the table, so an action nothing has done yet is still offered.',
        tags: ['Audit Log'],
        response: {
          200: {
            description: 'Action keys grouped by area',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { $ref: 'AuditKind#' },
                actions: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async () => {
      return AUDIT_KINDS.map((kind) => ({ kind, actions: [...AUDIT_ACTIONS[kind]] }))
    }
  )

  /**
   * GET AUDIT CONFIG
   */
  app.get(
    '/config',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get the audit log retention settings',
        description:
          'Reading the log needs `read:audit`; changing how long it is kept is a system setting and needs `manage:system` — shortening the retention destroys evidence, which is not the same authority as looking at it.',
        tags: ['Audit Log'],
        response: {
          200: { $ref: 'AuditConfig#' }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const [total, oldestEntry] = await Promise.all([
        WIKI.models.auditLog.total(),
        WIKI.models.auditLog.oldestEntry()
      ])
      return {
        retentionDays: WIKI.models.auditLog.retentionDays(),
        total,
        oldestEntry
      }
    }
  )

  /**
   * UPDATE AUDIT CONFIG
   */
  app.put<{ Body: { retentionDays: number } }>(
    '/config',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Set how long audit log entries are kept',
        description: `Takes effect the next time the daily \`purgeAuditLog\` task runs; nothing is deleted by saving. The change is itself recorded in the log.

Either zero — keep everything for ever — or at least ${MIN_RETENTION_DAYS} days. Nothing between the two is accepted: retention is the one setting whose effect is to destroy this table, and the person who can change it is the person it exists to record, so a value short enough to outrun discovery is refused rather than offered.`,
        tags: ['Audit Log'],
        body: {
          type: 'object',
          properties: {
            retentionDays: {
              type: 'integer',
              minimum: 0,
              maximum: 36500,
              description: `Days to keep. Zero keeps everything for ever; anything else is at least ${MIN_RETENTION_DAYS}.`
            }
          },
          required: ['retentionDays']
        },
        response: {
          200: {
            description: 'Retention updated',
            type: 'object',
            properties: {
              retentionDays: { type: 'integer' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      /*
        Checked here rather than in the JSON Schema: "zero or at least thirty" is expressible as an
        `anyOf`, but what comes back from one is a validation error naming neither branch, and this
        is a refusal whose reason is the whole point of it.
      */
      if (req.body.retentionDays > 0 && req.body.retentionDays < MIN_RETENTION_DAYS) {
        return reply.badRequest(
          `Audit log retention must be at least ${MIN_RETENTION_DAYS} days, or zero to keep entries for ever.`
        )
      }

      const previous = WIKI.models.auditLog.retentionDays()
      await WIKI.models.settings.updateConfig('audit', { retentionDays: req.body.retentionDays })
      WIKI.config.audit = { ...WIKI.config.audit, retentionDays: req.body.retentionDays }

      await audit(req, 'admin', 'updateAuditConfig', {
        retentionDays: req.body.retentionDays,
        previousRetentionDays: previous
      })

      return { retentionDays: req.body.retentionDays }
    }
  )
}

export default routes
