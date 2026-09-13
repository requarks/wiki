import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * PASSKEY - One registered authenticator, without any of its key material
   */
  app.addSchema({
    $id: 'Passkey',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The WebAuthn credential ID, base64url-encoded.'
      },
      name: {
        type: 'string',
        description: 'What the user called it, e.g. the device it lives on.'
      },
      siteHostname: {
        type: 'string',
        description:
          'The hostname it was registered against. A passkey only works on that host, so this is stored rather than resolved from the site, which may since have been renamed.'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      }
    }
  })

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
   * USER PROFILE - The logged in user's own view of itself
   *
   * The `meta` / `prefs` blobs are flattened into plain fields here. Values are deliberately typed as
   * strings rather than enums: this is the serialized response, and a preference stored before an
   * option existed must still be readable.
   */
  app.addSchema({
    $id: 'UserProfile',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string'
      },
      email: {
        type: 'string',
        format: 'email'
      },
      hasAvatar: {
        type: 'boolean'
      },
      handle: {
        type: 'string',
        description:
          'The name this user is mentioned by in a comment, without the `@`. An empty string for somebody who has not set one, who is therefore not mentionable — nothing is derived from a display name on anybody’s behalf.'
      },
      location: {
        type: 'string'
      },
      jobTitle: {
        type: 'string'
      },
      pronouns: {
        type: 'string'
      },
      timezone: {
        type: 'string',
        description: 'IANA time zone name, or an empty string to use the client time zone.'
      },
      dateFormat: {
        type: 'string',
        description: 'Empty string means the locale default.'
      },
      timeFormat: {
        type: 'string'
      },
      appearance: {
        type: 'string'
      },
      cvd: {
        type: 'string',
        description: 'Color vision deficiency to adjust the palette for.'
      }
    }
  })

  /**
   * PUBLIC USER PROFILE - What a user's profile page shows anyone who opens it
   *
   * Everything here is either something the user typed into their own profile to be seen, or the fact
   * that they were here. The email is absent on purpose — see `PublicUserProfile` in the model.
   */
  app.addSchema({
    $id: 'PublicUserProfile',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string'
      },
      hasAvatar: {
        type: 'boolean'
      },
      handle: {
        type: 'string',
        description:
          'The handle this user is mentioned by, without the `@`, or an empty string if they have not set one. Public because it is written into every comment that mentions them.'
      },
      location: {
        type: 'string'
      },
      jobTitle: {
        type: 'string'
      },
      pronouns: {
        type: 'string'
      },
      timezone: {
        type: 'string',
        description:
          'IANA time zone name, or an empty string for a user who never picked one — in which case there is no local time to show for them.'
      },
      lastLoginAt: {
        // -> `nullable` rather than a type array, as on `UserCore`: the emitted spec is OpenAPI 3.0
        type: 'string',
        nullable: true,
        format: 'date-time',
        description: 'RFC 3339 Date Time, or null if the user has never logged in'
      }
    }
  })

  /**
   * USER PROFILE UPDATE - The fields a user may change on its own profile
   *
   * The email is absent on purpose: it identifies the account and is the local strategy's username.
   */
  app.addSchema({
    $id: 'UserProfileUpdate',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255
      },
      handle: {
        type: 'string',
        maxLength: 32,
        pattern: '^$|^[A-Za-z0-9_-]{3,32}$',
        description:
          'The name to be mentioned by in comments, without the `@`. Unique across the wiki, case-insensitively; an empty string takes it off. 409 if somebody else already has it.'
      },
      location: {
        type: 'string',
        maxLength: 255
      },
      jobTitle: {
        type: 'string',
        maxLength: 255
      },
      pronouns: {
        type: 'string',
        maxLength: 255
      },
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
      },
      appearance: {
        type: 'string',
        enum: ['site', 'light', 'dark']
      },
      cvd: {
        type: 'string',
        enum: ['none', 'protanopia', 'deuteranopia', 'tritanopia']
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
              'Authentication providers linked to this user. Secrets are never included — `config.isPasswordSet` and `config.isTfaSetup` report their state instead.',
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
