import {
  GLOSSARY_ALIASES_MAX,
  GLOSSARY_DEFINITION_MAX_LENGTH,
  GLOSSARY_NAME_MAX_LENGTH,
  GLOSSARY_REFERENCES_MAX,
  GLOSSARY_RELATED_MAX
} from '../../models/glossary.ts'
import type { FastifyInstance } from 'fastify'

/** The properties of a term the sidebar lists, shared by the summary and the full term. */
const summaryProperties = {
  id: { type: 'string', format: 'uuid' },
  term: { type: 'string' },
  expansion: {
    type: ['string', 'null'],
    description: 'The full form, when the term is an abbreviation.'
  },
  aliases: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Alternate forms and inflections. Unique across every term of the locale, like the term itself.'
  },
  category: { type: ['string', 'null'] },
  caseSensitive: {
    type: 'boolean',
    description:
      'Whether the term matches text only with its exact case. About matching in text, never about uniqueness: `REST` and `rest` cannot be two terms either way.'
  },
  autoLink: {
    type: 'boolean',
    description:
      'Whether the term is linked automatically where it appears in page text. Stored, and not yet acted on.'
  }
}

/**
 * What a create or a save carries, as properties to spread into a route's body schema: the create adds
 * `locale`, the save `expectedUpdatedAt`. Properties rather than a registered schema, because a body
 * built from a `$ref` plus a property of its own needs `allOf`, and the coercion and defaults Fastify
 * applies are less predictable through one.
 */
export const GLOSSARY_INPUT_PROPERTIES = {
  term: { type: 'string', minLength: 1, maxLength: GLOSSARY_NAME_MAX_LENGTH },
  expansion: { type: ['string', 'null'], maxLength: GLOSSARY_NAME_MAX_LENGTH },
  definition: { type: 'string', maxLength: GLOSSARY_DEFINITION_MAX_LENGTH },
  aliases: {
    type: 'array',
    maxItems: GLOSSARY_ALIASES_MAX,
    items: { type: 'string', maxLength: GLOSSARY_NAME_MAX_LENGTH },
    description:
      'Repeats, and copies of the term itself, are dropped rather than refused. A name another term already holds, as its term or an alias, is refused with 409.'
  },
  relatedTerms: {
    type: 'array',
    maxItems: GLOSSARY_RELATED_MAX,
    items: { type: 'string', format: 'uuid' },
    description:
      'IDs of terms in the same site and locale. Replaces the whole list, from both sides: a term taken out of this list loses this one from its own.'
  },
  documentationPath: {
    type: ['string', 'null'],
    maxLength: GLOSSARY_NAME_MAX_LENGTH,
    description: 'A page path in the term’s own locale, without a locale prefix.'
  },
  documentationLabel: { type: ['string', 'null'], maxLength: GLOSSARY_NAME_MAX_LENGTH },
  references: {
    type: 'array',
    maxItems: GLOSSARY_REFERENCES_MAX,
    items: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          maxLength: 2048,
          pattern: '^https?://',
          description: '`http:` or `https:` only.'
        },
        label: { type: 'string', maxLength: GLOSSARY_NAME_MAX_LENGTH }
      }
    }
  },
  caseSensitive: { type: 'boolean', default: false },
  autoLink: { type: 'boolean', default: true },
  category: { type: ['string', 'null'], maxLength: GLOSSARY_NAME_MAX_LENGTH }
}

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * GLOSSARY TERM SUMMARY - A term as the glossary's list shows it
   */
  app.addSchema({
    $id: 'GlossaryTermSummary',
    type: 'object',
    properties: summaryProperties
  })

  /**
   * GLOSSARY TERM - A term in full
   */
  app.addSchema({
    $id: 'GlossaryTerm',
    type: 'object',
    properties: {
      ...summaryProperties,
      siteId: { type: 'string', format: 'uuid' },
      locale: { type: 'string' },
      definition: {
        type: 'string',
        description: 'Basic markdown, never HTML. Rendered by the client with raw HTML disabled.'
      },
      references: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            label: { type: 'string', description: 'Empty when the URL stands in for one.' }
          }
        }
      },
      relatedTerms: {
        type: 'array',
        description:
          'Related terms, which is two-way: a term lists every term that lists it. A–Z by name.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            term: { type: 'string' }
          }
        }
      },
      documentation: {
        type: ['object', 'null'],
        description:
          'The page in the same locale that documents the term, looked up as it is read. Null when none is named; `exists` false when the named path has no page.',
        properties: {
          path: { type: 'string' },
          label: {
            type: ['string', 'null'],
            description: 'The link text. Null for the default, which the client supplies.'
          },
          title: { type: ['string', 'null'] },
          exists: { type: 'boolean' }
        }
      },
      author: {
        type: ['object', 'null'],
        description: 'Who saved it last. Null for an API key, or once the account is gone.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' }
        }
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description:
          'At millisecond precision. A save names the value it was opened with as `expectedUpdatedAt`.'
      }
    }
  })

  /**
   * GLOSSARY CONFLICT - Why a write answered 409
   */
  app.addSchema({
    $id: 'GlossaryConflict',
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      statusCode: { type: 'integer' },
      error: { type: 'string' },
      message: { type: 'string' },
      reason: {
        type: 'string',
        enum: ['nameTaken', 'stale'],
        description:
          '`nameTaken`: another term already holds one of the names. `stale`: somebody saved the term after the caller opened it.'
      },
      field: {
        type: 'string',
        enum: ['term', 'aliases'],
        description: 'For `nameTaken`, which of the caller’s fields holds the name.'
      },
      name: { type: 'string', description: 'For `nameTaken`, the name that is held.' },
      holder: {
        type: 'object',
        description: 'For `nameTaken`, the term holding it.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          term: { type: 'string' }
        }
      },
      current: {
        $ref: 'GlossaryTerm#',
        description: 'For `stale`, the term as it now stands.'
      }
    }
  })
}
