import type { FastifyInstance } from 'fastify'

/**
 * Shared schemas for the import API.
 *
 * The record streams themselves are deliberately NOT schema'd here. What a `.wkbackup` line looks
 * like is `dev/specs/wkbackup.md` §12's business, it varies per stream and per `schema` version, and
 * the models are what read it — validating it twice, in a shape that has to be kept in step with a
 * document in another repository, would buy a worse error message than the importer's own.
 */
export function registerSchemas(app: FastifyInstance) {
  app.addSchema({
    $id: 'ImportPreflight',
    type: 'object',
    properties: {
      ok: { type: 'boolean', description: 'False when `errors` is non-empty.' },
      errors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Reasons the package cannot be imported at all.'
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Things the import will carry on past, including anything the exporter itself reported it could not represent.'
      }
    }
  })

  app.addSchema({
    $id: 'ImportSession',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      namespace: {
        type: 'string',
        format: 'uuid',
        description: 'The UUIDv5 namespace this import derives its record ids in.'
      },
      source: { type: 'string' },
      sites: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            siteId: { type: 'string', format: 'uuid' }
          }
        }
      },
      includes: { type: 'array', items: { type: 'string' } },
      overwrite: { type: 'boolean' },
      htmlConversion: { type: 'string', enum: ['markdown', 'html'] },
      state: { type: 'string', enum: ['open', 'finished', 'failed'] },
      progress: {
        type: 'object',
        additionalProperties: { type: 'integer' },
        description: 'Records written so far, per stream.'
      },
      warnings: { type: 'array', items: { type: 'string' } },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' }
    }
  })

  app.addSchema({
    $id: 'ImportBatch',
    type: 'object',
    properties: {
      imported: { type: 'integer' },
      skipped: {
        type: 'integer',
        description:
          'Records the import passed over — already present with overwrite off, missing a page to hang off, or incomplete. Never a failure.'
      },
      warnings: { type: 'array', items: { type: 'string' } }
    }
  })

  app.addSchema({
    $id: 'ImportSummary',
    type: 'object',
    properties: {
      progress: { type: 'object', additionalProperties: { type: 'integer' } },
      warnings: { type: 'array', items: { type: 'string' } },
      pendingRenders: {
        type: 'integer',
        description: 'Imported pages waiting on the render queue.'
      },
      unrenderable: {
        type: 'integer',
        description:
          'Imported pages this wiki has no server-side renderer for. They keep their placeholder until somebody opens and saves them.'
      }
    }
  })
}
