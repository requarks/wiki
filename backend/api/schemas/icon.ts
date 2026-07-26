import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * ICON SET - An Iconify icon set added to this wiki
   */
  app.addSchema({
    $id: 'IconSet',
    type: 'object',
    properties: {
      prefix: {
        type: 'string',
        description: 'Iconify prefix, i.e. the part before the colon in `mdi:account-edit`.'
      },
      name: {
        type: 'string'
      },
      isEnabled: {
        type: 'boolean',
        description:
          'A disabled set is not searchable and takes on no new icons, but the icons already stored for it keep being served so that published content does not break.'
      },
      info: {
        type: 'object',
        additionalProperties: true,
        description:
          'Iconify collection metadata (author, license, total, palette, samples, …) as published upstream. Empty until the first metadata refresh, which needs outbound access.'
      },
      iconCount: {
        type: 'integer',
        description:
          'Icons of this set stored in the database, i.e. what this instance can serve without the upstream API.'
      },
      refreshedAt: {
        type: 'string',
        nullable: true
      },
      createdAt: {
        type: 'string'
      }
    }
  })

  /**
   * AVAILABLE ICON SET - A set offered upstream, whether or not it is added here
   */
  app.addSchema({
    $id: 'AvailableIconSet',
    type: 'object',
    properties: {
      prefix: {
        type: 'string'
      },
      name: {
        type: 'string'
      },
      total: {
        type: 'integer',
        description: 'How many icons the set holds upstream.'
      },
      author: {
        type: 'string'
      },
      license: {
        type: 'string'
      },
      category: {
        type: 'string'
      },
      palette: {
        type: 'boolean',
        description:
          'Whether the icons carry their own colors, in which case they cannot be recolored.'
      },
      samples: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'A few icon names from the set, for a preview.'
      },
      isAdded: {
        type: 'boolean'
      }
    }
  })
}
