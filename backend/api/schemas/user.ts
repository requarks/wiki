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
   * USER DEFAULTS - Instance-wide defaults applied to new users
   */
  app.addSchema({
    $id: 'UserDefaults',
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'IANA time zone name, e.g. `America/New_York`.',
        maxLength: 255
      },
      dateFormat: {
        type: 'string',
        description: 'Empty string means the locale default.',
        enum: ['', 'DD/MM/YYYY', 'DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD']
      },
      timeFormat: {
        type: 'string',
        enum: ['12h', '24h']
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
            type: 'array',
            description:
              'Authentication providers linked to this user. Secrets are never included — `config.isPasswordSet` and `config.tfaIsActive` report their state instead.',
            items: {
              type: 'object',
              properties: {
                authId: {
                  type: 'string',
                  format: 'uuid'
                },
                authName: {
                  type: 'string'
                },
                strategyKey: {
                  type: 'string'
                },
                strategyIcon: {
                  type: 'string'
                },
                config: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          },
          groups: {
            type: 'array',
            description: 'Groups this user belongs to.',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                name: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    ]
  })
}
