import type { FastifyInstance } from 'fastify'

/**
 * Users API Routes
 */
async function routes(app: FastifyInstance) {
  app.get<{ Querystring: { page?: number; limit?: number } }>(
    '/',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'List all users',
        tags: ['Users'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        },
        response: {
          200: {
            description: 'List of Users',
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              users: {
                type: 'array',
                items: { $ref: 'UserCore#' }
              }
            }
          }
        }
      }
    },
    async () => {
      return { hello: 'world' }
    }
  )

  app.get(
    '/whoami',
    {
      schema: {
        summary: 'Get currently logged in user info',
        tags: ['Users']
      }
    },
    async (req, reply) => {
      reply.preventCache()
      if (req.session?.authenticated) {
        return {
          authenticated: true,
          ...req.session.user,
          permissions: ['manage:system'] // TODO: pull actual permissions
        }
      } else {
        return {
          authenticated: false
        }
      }
    }
  )

  app.get<{ Params: { userId: string } }>(
    '/:userId',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'Get user info',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          }
        },
        response: {
          200: {
            description: 'User info',
            type: 'object',
            $ref: 'User#'
          }
        }
      }
    },
    async () => {
      return { hello: 'world' }
    }
  )

  app.post(
    '/',
    {
      config: {
        permissions: ['create:users', 'manage:users']
      },
      schema: {
        summary: 'Create a new user',
        tags: ['Users']
      }
    },
    async () => {
      return { hello: 'world' }
    }
  )

  app.put<{ Params: { userId: string } }>(
    '/:userId',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Update a user',
        tags: ['Users']
      }
    },
    async () => {
      return { hello: 'world' }
    }
  )

  app.delete<{ Params: { userId: string } }>(
    '/:userId',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Delete a user',
        tags: ['Users']
      }
    },
    async () => {
      return { hello: 'world' }
    }
  )
}

export default routes
