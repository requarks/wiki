/**
 * Users API Routes
 */
async function routes (app, options) {
  app.get('/', {
    schema: {
      summary: 'List all users',
      tags: ['Users']
    }
  }, async (request, reply) => {
    return { hello: 'world' }
  })

  app.get('/:userId', {
    schema: {
      summary: 'Get user info',
      tags: ['Users']
    }
  }, async (request, reply) => {
    return { hello: 'world' }
  })

  app.post('/', {
    schema: {
      summary: 'Create a new user',
      tags: ['Users']
    }
  }, async (request, reply) => {
    return { hello: 'world' }
  })

  app.put('/:userId', {
    schema: {
      summary: 'Update a user',
      tags: ['Users']
    }
  }, async (request, reply) => {
    return { hello: 'world' }
  })

  app.delete('/:userId', {
    schema: {
      summary: 'Delete a user',
      tags: ['Users']
    }
  }, async (request, reply) => {
    return { hello: 'world' }
  })
}

export default routes
