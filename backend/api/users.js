/**
 * Users API Routes
 */
async function routes(app, options) {
  app.get(
    '/',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'List all users',
        tags: ['Users']
      }
    },
    async (request, reply) => {
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
          permissions: ['manage:system']
        }
      } else {
        return {
          authenticated: false
        }
      }
    }
  )

  app.get(
    '/:userId',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'Get user info',
        tags: ['Users']
      }
    },
    async (request, reply) => {
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
    async (request, reply) => {
      return { hello: 'world' }
    }
  )

  app.put(
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
    async (request, reply) => {
      return { hello: 'world' }
    }
  )

  app.delete(
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
    async (request, reply) => {
      return { hello: 'world' }
    }
  )
}

export default routes
