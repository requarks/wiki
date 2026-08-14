import type { FastifyInstance } from 'fastify'
import type { KeyExpiration } from '../models/apiKeys.ts'

/**
 * API Keys Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST API KEYS
   */
  app.get(
    '/',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List all API keys',
        description:
          'Revoked and expired keys are listed too, so that the admin area can show their state.',
        tags: ['API Keys'],
        response: {
          200: {
            description: 'List of API keys',
            type: 'array',
            items: { $ref: 'ApiKey#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.apiKeys.getKeys()
    }
  )

  /**
   * CREATE API KEY
   */
  app.post<{
    Body: { name: string; expiration: KeyExpiration; groups: string[] }
  }>(
    '/',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Create a new API key',
        description:
          'The response carries the token, which is the only time it can be read: only its last characters are stored. The key holds the combined permissions of the groups given.',
        tags: ['API Keys'],
        body: {
          type: 'object',
          required: ['name', 'expiration', 'groups'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'What the key is for.'
            },
            expiration: { $ref: 'ApiKeyExpiration#' },
            groups: {
              type: 'array',
              minItems: 1,
              description:
                'Groups whose permissions the key carries. The guests group is not accepted.',
              items: {
                type: 'string',
                format: 'uuid'
              }
            }
          }
        },
        response: {
          200: {
            description: 'API key created successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              id: {
                type: 'string',
                format: 'uuid'
              },
              key: {
                type: 'string',
                description: 'The token. Shown once and never again.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!/^[^<>"]+$/.test(req.body.name)) {
        return reply.badRequest('Key name contains invalid characters.')
      }

      // -> A key inherits group permissions, so every group must exist; a stale client should not
      //    silently mint a key with fewer permissions than the operator picked
      const known = await WIKI.models.groups.getAllGroups()
      for (const groupId of req.body.groups) {
        if (!known.some((g) => g.id === groupId)) {
          return reply.badRequest('One of the groups does not exist.')
        }
        // -> Guests are anonymous visitors: a key holding their permissions grants nothing a caller
        //    could not already do without one
        if (groupId === WIKI.data.systemIds.guestsGroupId) {
          return reply.badRequest('The guests group cannot be used for API keys.')
        }
      }

      const { id, key } = await WIKI.models.apiKeys.createKey({
        name: req.body.name,
        expiration: req.body.expiration,
        groups: req.body.groups
      })

      return {
        ok: true,
        message: 'API key created successfully.',
        id,
        key
      }
    }
  )

  /**
   * REVOKE API KEY
   */
  app.post<{ Params: { keyId: string } }>(
    '/:keyId/revoke',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Revoke an API key',
        description:
          'Permanent: the key stays listed as revoked and stops authenticating on the next request. Revoking never deletes, so the record of what existed is kept — `POST /system/api-keys/purge` is what discards those rows, when an administrator asks for it.',
        tags: ['API Keys'],
        params: {
          type: 'object',
          properties: {
            keyId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['keyId']
        },
        response: {
          200: {
            description: 'API key revoked successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const key = await WIKI.models.apiKeys.getKeyById(req.params.keyId)
      if (!key) {
        return reply.notFound('API key does not exist.')
      }
      if (key.isRevoked) {
        return reply.conflict('This API key is already revoked.')
      }

      await WIKI.models.apiKeys.revokeKey(key.id)

      return {
        ok: true,
        message: 'API key revoked successfully.'
      }
    }
  )
}

export default routes
