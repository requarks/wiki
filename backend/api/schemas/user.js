export async function registerSchemas(app) {
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
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
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
