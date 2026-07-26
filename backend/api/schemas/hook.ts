import type { FastifyInstance } from 'fastify'
import { HOOK_EVENTS } from '../../models/hooks.ts'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * HOOK INPUT - The writable fields, used for both create and update
   */
  app.addSchema({
    $id: 'HookInput',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255
      },
      events: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          enum: HOOK_EVENTS
        }
      },
      url: {
        type: 'string',
        maxLength: 2048,
        description: 'Where to POST the event. Must be an http or https address.'
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Include the event metadata, such as a page title and author.'
      },
      includeContent: {
        type: 'boolean',
        description: 'Include the full content, e.g. a page body. Payloads can get large.'
      },
      acceptUntrusted: {
        type: 'boolean',
        description: 'Skip TLS certificate validation for this endpoint.'
      },
      authHeader: {
        type: 'string',
        maxLength: 2048,
        description: 'Sent verbatim as the Authorization header.'
      }
    }
  })

  /**
   * HOOK - A webhook with the outcome of its last delivery
   */
  app.addSchema({
    $id: 'Hook',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string'
      },
      events: {
        type: 'array',
        items: { type: 'string' }
      },
      url: {
        type: 'string'
      },
      includeMetadata: {
        type: 'boolean'
      },
      includeContent: {
        type: 'boolean'
      },
      acceptUntrusted: {
        type: 'boolean'
      },
      authHeader: {
        type: 'string',
        nullable: true
      },
      state: {
        type: 'string',
        enum: ['pending', 'success', 'error'],
        description:
          '`pending` until an event reaches it, then the outcome of the most recent delivery.'
      },
      lastErrorMessage: {
        type: 'string',
        nullable: true,
        description: 'Why the last delivery failed. Null unless the state is `error`.'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      }
    }
  })
}
