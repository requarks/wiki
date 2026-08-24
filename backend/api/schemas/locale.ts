import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * LOCALE
   *
   * One row of the locale list, as `locales` and `bootstrap` hand it out. `code` is the identity —
   * the language tag the strings file is published under, what a page's `locale` holds, and what a
   * storage target files it under. Everything beside it says how this wiki refers to that locale,
   * and is resolved on the way out rather than stored, since it depends on which other locales exist.
   */
  app.addSchema({
    $id: 'Locale',
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The language tag identifying this locale, e.g. `zh-CN`.'
      },
      language: {
        type: 'string',
        description: 'The bare language subtag, e.g. `zh`.'
      },
      name: {
        type: 'string',
        description:
          'The name in English, qualified by region only where a second locale shares the language: "German", but "Chinese (China)" beside "Chinese (Taiwan)".'
      },
      nativeName: {
        type: 'string',
        description: 'The same name, in the locale itself.'
      },
      customName: {
        type: ['string', 'null'],
        description: 'The name an administrator set instead, or null.'
      },
      customCode: {
        type: ['string', 'null'],
        description: 'The short code an administrator set instead, or null.'
      },
      derivedCode: {
        type: 'string',
        description:
          'The short code the tag gives on its own: the language subtag where nothing else shares it, the whole tag where something does. What clearing `customCode` goes back to.'
      },
      displayCode: {
        type: 'string',
        description: 'The short code to show: `customCode`, or `derivedCode`.'
      },
      displayName: {
        type: 'string',
        description:
          'The single line to show wherever the locale is offered rather than described: `customName`, or the native name.'
      },
      isRTL: {
        type: 'boolean',
        description: 'Whether the script runs right to left.'
      },
      isInstalled: {
        type: 'boolean',
        description:
          'Whether the strings have been downloaded. A locale that is merely published upstream has a row so it can be offered, but nothing to serve until it is installed.'
      },
      completeness: {
        type: 'integer',
        description: 'How much of the string set is translated, as a percentage.'
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      }
    }
  })
}
