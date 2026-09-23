import type { FastifyInstance } from 'fastify'
import { audit } from '../helpers/audit.ts'
import {
  IMPORT_CONTENT_KINDS,
  MAX_BATCH_BYTES,
  MAX_BATCH_RECORDS,
  MAX_BLOB_BYTES,
  type ImportSessionSite
} from '../models/import.ts'

/**
 * Import API Routes
 *
 * `dev/specs/wkbackup.md` §7 is the design. The package is never uploaded: the browser holds it,
 * walks it, and drives these routes a batch at a time.
 *
 * **Every route takes `manage:system`**, and that is the spec's §5 rather than laziness. An import
 * writes groups and puts accounts into them, which is precisely the escalation `elevatedGroupGuard`
 * exists to stop; anything narrower would have to re-implement those guards per record and would
 * still add up to a route to every permission on the wiki. A dedicated `manage:import` would be a new
 * global permission, which is the maintainer's call and not something to introduce alongside a
 * feature.
 *
 * The session is instance-level rather than under `/sites/:siteId`, because half of what it writes
 * belongs to no site.
 */
async function routes(app: FastifyInstance) {
  /*
    A blob is the raw bytes rather than a multipart form: one file per request, named by its own
    SHA-256 in the path. The catch-all only claims content types nothing else parses, so the JSON
    routes below are unaffected.
  */
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: MAX_BLOB_BYTES },
    (req, body, done) => {
      done(null, body)
    }
  )

  /**
   * PREFLIGHT A PACKAGE
   */
  app.post<{ Body: { manifest: any; siteId: string } }>(
    '/import/preflight',
    {
      config: { permissions: ['manage:system'] },
      schema: {
        summary: 'Check a backup package before importing it',
        description:
          'Everything answerable from `manifest.json` alone — the container version, the source kind, that every stream it promises has a path and a schema this wiki can read, and that the target site exists. The browser has the manifest in hand within a second of opening the file, whatever the rest of it weighs, so this is what fails an unreadable eight-gigabyte package immediately rather than forty minutes in.\n\n`errors` stops the import; `warnings` are things it will carry on past and the operator should see first — including anything the exporter itself could not represent.',
        tags: ['Import'],
        body: {
          type: 'object',
          properties: {
            manifest: { type: 'object', additionalProperties: true },
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['manifest', 'siteId']
        },
        response: {
          200: { $ref: 'ImportPreflight#' }
        }
      }
    },
    async (req) => {
      return WIKI.models.importer.preflight(req.body.manifest, req.body.siteId)
    }
  )

  /**
   * CREATE AN IMPORT SESSION
   */
  app.post<{
    Body: {
      source: string
      sourceInstanceId?: string
      sites: ImportSessionSite[]
      includes: string[]
      overwrite?: boolean
    }
  }>(
    '/import/sessions',
    {
      config: { permissions: ['manage:system'] },
      schema: {
        summary: 'Open an import session',
        description:
          'Settles once what every later batch depends on: which target site each package site lands in, what the operator chose to bring over, and whether an existing record is replaced.\n\nThe session is a row rather than server memory, so a batch may be answered by any instance of an HA set and a browser that was interrupted can ask where it got to.\n\nIt also carries the UUID namespace this import derives record ids in, and that namespace is a function of the source wiki and the target site rather than of the session — so an import that fell over can simply be run again from the top without laying down a second copy of every comment and every history entry.',
        tags: ['Import'],
        body: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: '`manifest.source.kind`. Only `wikijs2` is implemented.'
            },
            sourceInstanceId: {
              type: 'string',
              description:
                '`manifest.source.instanceId`. Part of the namespace this import derives record ids in, so that two different source wikis imported into one site cannot derive the same id for two different comments.'
            },
            sites: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sourceId: { type: 'string' },
                  siteId: { type: 'string', format: 'uuid' }
                },
                required: ['sourceId', 'siteId']
              }
            },
            includes: {
              type: 'array',
              items: { type: 'string', enum: [...IMPORT_CONTENT_KINDS] },
              description:
                'Settings are not importable — which 2.x key means what in 3.x is being settled separately.'
            },
            overwrite: { type: 'boolean', default: false }
          },
          required: ['source', 'sites', 'includes']
        },
        response: {
          200: { $ref: 'ImportSession#' }
        }
      }
    },
    async (req) => {
      const session = await WIKI.models.importer.createSession({
        source: req.body.source,
        sourceInstanceId: req.body.sourceInstanceId,
        sites: req.body.sites,
        includes: req.body.includes,
        overwrite: req.body.overwrite === true,
        actorId: req.session?.user?.id ?? null
      })
      await audit(req, 'admin', 'startImport', {
        sessionId: session.id,
        source: session.source,
        includes: session.includes,
        overwrite: session.overwrite,
        siteIds: session.sites.map((entry) => entry.siteId)
      })
      return session
    }
  )

  /**
   * READ AN IMPORT SESSION
   */
  app.get<{ Params: { sessionId: string } }>(
    '/import/sessions/:sessionId',
    {
      config: { permissions: ['manage:system'] },
      schema: {
        summary: 'Read an import session',
        description:
          'What has been written so far, per stream, and everything the import could not carry. This is what a browser that was interrupted reads to find its place: records are keyed so that replaying one is an upsert, so resuming is replaying from the last counted batch.',
        tags: ['Import'],
        params: {
          type: 'object',
          properties: { sessionId: { type: 'string', format: 'uuid' } },
          required: ['sessionId']
        },
        response: {
          200: { $ref: 'ImportSession#' }
        }
      }
    },
    async (req, reply) => {
      const session = await WIKI.models.importer.getSession(req.params.sessionId)
      if (!session) {
        return reply.notFound('No such import session.')
      }
      return session
    }
  )

  /**
   * UPLOAD A BLOB
   */
  app.post<{ Params: { sessionId: string; digest: string } }>(
    '/import/sessions/:sessionId/blobs/:digest',
    {
      config: { permissions: ['manage:system'] },
      schema: {
        summary: 'Upload one of a package’s blobs',
        description: `The body is the file itself, not a multipart form — send the bytes with \`Content-Type: application/octet-stream\`. At most ${MAX_BLOB_BYTES / 1024 / 1024 / 1024} GB.\n\nThe path segment is the file's SHA-256, which is also what names it inside the package, and it is **verified** rather than trusted: the name being the checksum is the whole of what content addressing establishes.\n\nBlobs are uploaded before the metadata that references them, and once each however many records point at the same bytes. They wait in a staging directory that \`finish\` removes.`,
        tags: ['Import'],
        consumes: ['application/octet-stream'],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
            digest: { type: 'string', pattern: '^[0-9a-f]{64}$' }
          },
          required: ['sessionId', 'digest']
        },
        response: {
          200: {
            description: 'Blob staged',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              bytes: { type: 'integer' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      await WIKI.models.importer.requireOpenSession(req.params.sessionId)
      const data = req.body
      if (!Buffer.isBuffer(data) || data.length < 1) {
        return reply.badRequest('No file was sent.')
      }
      const { bytes } = await WIKI.models.importer.putBlob(
        req.params.sessionId,
        req.params.digest,
        data
      )
      return { ok: true, bytes }
    }
  )

  /**
   * INGEST AN INSTANCE-WIDE STREAM
   */
  app.post<{ Params: { sessionId: string; stream: string }; Body: { records: any[] } }>(
    '/import/sessions/:sessionId/streams/:stream',
    {
      config: { permissions: ['manage:system'] },
      // -> Above the instance-wide JSON limit; see `MAX_BATCH_BYTES`
      bodyLimit: MAX_BATCH_BYTES,
      schema: {
        summary: 'Write a batch of instance-wide records',
        description: `Users, groups and locales belong to the wiki rather than to any one site, which is why the session is not itself under a site.\n\nAt most ${MAX_BATCH_RECORDS} records and ${MAX_BATCH_BYTES / 1024 / 1024} MB per request. A stream whose content kind the session was not opened for is refused rather than ignored, and a stream name this wiki has no reader for is refused too — a batch that was quietly dropped is a migration that quietly lost something.`,
        tags: ['Import'],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
            stream: { type: 'string', enum: ['locales', 'groups', 'users'] }
          },
          required: ['sessionId', 'stream']
        },
        body: {
          type: 'object',
          properties: {
            records: { type: 'array', items: { type: 'object', additionalProperties: true } }
          },
          required: ['records']
        },
        response: {
          200: { $ref: 'ImportBatch#' }
        }
      }
    },
    async (req) => {
      return WIKI.models.importer.ingest({
        sessionId: req.params.sessionId,
        stream: req.params.stream,
        records: req.body.records
      })
    }
  )

  /**
   * INGEST A SITE STREAM
   */
  app.post<{
    Params: { sessionId: string; siteId: string; stream: string }
    Body: { records: any[] }
  }>(
    '/import/sessions/:sessionId/sites/:siteId/streams/:stream',
    {
      config: { permissions: ['manage:system'] },
      /*
        Above the instance-wide JSON limit, and this is the route that needs it: a batch of pages or
        of page history is a batch of whole documents, where a batch of anything else is a batch of
        rows. See `MAX_BATCH_BYTES`.
      */
      bodyLimit: MAX_BATCH_BYTES,
      schema: {
        summary: 'Write a batch of records belonging to one site',
        description: `The site is a target site on THIS instance, one the session was opened for — a package site the operator did not map is never read.\n\nAt most ${MAX_BATCH_RECORDS} records and ${MAX_BATCH_BYTES / 1024 / 1024} MB per request; a batch of pages or of page history is a batch of whole documents, so the byte ceiling is usually what a caller meets first.\n\nOrder matters between these streams and is the caller's to keep: folders and the site's own settings, then blobs, then pages, then the history and comments that hang off them, then the assets those blobs belong to, then navigation. A record whose page was not imported is skipped rather than failing its batch.`,
        tags: ['Import'],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
            siteId: { type: 'string', format: 'uuid' },
            stream: {
              type: 'string',
              enum: ['tree', 'site', 'pages', 'page-history', 'assets', 'comments', 'navigation']
            }
          },
          required: ['sessionId', 'siteId', 'stream']
        },
        body: {
          type: 'object',
          properties: {
            records: { type: 'array', items: { type: 'object', additionalProperties: true } }
          },
          required: ['records']
        },
        response: {
          200: { $ref: 'ImportBatch#' }
        }
      }
    },
    async (req) => {
      return WIKI.models.importer.ingest({
        sessionId: req.params.sessionId,
        stream: req.params.stream,
        siteId: req.params.siteId,
        records: req.body.records
      })
    }
  )

  /**
   * FINISH AN IMPORT SESSION
   */
  app.post<{ Params: { sessionId: string } }>(
    '/import/sessions/:sessionId/finish',
    {
      config: { permissions: ['manage:system'] },
      schema: {
        summary: 'Close an import session',
        description:
          'Drops the staged blobs and reports what happened. Nothing is rebuilt: every model the records went through did its own bookkeeping as it wrote — the tree entry, the storage-target copies, the search index, the queued render.\n\nThe two counts at the end are what an operator has to know about a 2.x import. A page arrives with no HTML, because a 2.x render is 2.x’s output and would be wrong here in ways nothing could later detect, so it carries a placeholder until the render queue reaches it — one headless browser, one page at a time. `unrenderable` is the pages this wiki has no server-side renderer for at all; those keep their placeholder until somebody opens and saves them, which is a to-do list rather than a failure.',
        tags: ['Import'],
        params: {
          type: 'object',
          properties: { sessionId: { type: 'string', format: 'uuid' } },
          required: ['sessionId']
        },
        response: {
          200: { $ref: 'ImportSummary#' }
        }
      }
    },
    async (req) => {
      const summary = await WIKI.models.importer.finishSession(req.params.sessionId)
      await audit(req, 'admin', 'finishImport', {
        sessionId: req.params.sessionId,
        progress: summary.progress,
        pendingRenders: summary.pendingRenders,
        unrenderable: summary.unrenderable
      })
      return summary
    }
  )
}

export default routes
