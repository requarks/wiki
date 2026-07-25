import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * USER CORE - Essential fields only
   */
  app.addSchema({
    $id: 'UserCore',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255
      },
      email: {
        type: 'string',
        format: 'email'
      },
      hasAvatar: {
        type: 'boolean'
      },
      isSystem: {
        type: 'boolean'
      },
      isActive: {
        type: 'boolean'
      },
      isVerified: {
        type: 'boolean'
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
      },
      lastLoginAt: {
        // -> Users who have never logged in have no value here, and a plain `string` would make the
        //    serializer coerce null to an empty string. `nullable` is used rather than
        //    `type: ['string', 'null']` because the emitted spec declares OpenAPI 3.0, where a type
        //    array is not valid.
        type: 'string',
        nullable: true,
        format: 'date-time',
        description: 'RFC 3339 Date Time, or null if the user has never logged in'
      }
    }
  })

  /**
   * USER - All fields
   */
  app.addSchema({
    $id: 'User',
    allOf: [
      {
        $ref: 'UserCore#'
      },
      {
        type: 'object',
        properties: {
          meta: {
            type: 'object',
            additionalProperties: true
          },
          prefs: {
            type: 'object',
            additionalProperties: true
          },
          auth: {
            type: 'string'
          },
          passkeys: {
            type: 'string'
          }
        }
      }
    ]
  })
}
