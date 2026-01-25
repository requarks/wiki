/**
 * Sites API Routes
 */
async function routes (app, options) {
  app.get('/', {
    schema: {
      summary: 'List all sites',
      tags: ['Sites']
    }
  }, async (req, reply) => {
    return { hello: 'world' }
  })

  app.get('/:siteId', {
    schema: {
      summary: 'Get site info',
      tags: ['Sites']
    }
  }, async (req, reply) => {
    return { hello: 'world' }
  })

  app.post('/', {
    schema: {
      summary: 'Create a new site',
      tags: ['Sites'],
      body: {
        type: 'object',
        required: ['name', 'hostname'],
        properties: {
          name: { type: 'string' },
          hostname: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    return { hello: 'world' }
  })

  app.put('/:siteId', {
    schema: {
      summary: 'Update a site',
      tags: ['Sites']
    }
  }, async (req, reply) => {
    return { hello: 'world' }
  })

  /**
   * DELETE SITE
   */
  app.delete('/:siteId', {
    schema: {
      summary: 'Delete a site',
      tags: ['Sites'],
      params: {
        type: 'object',
        properties: {
          siteId: {
            type: 'string',
            format: 'uuid'
          }
        },
        required: ['siteId']
      },
      response: {
        204: {
          description: 'Site deleted successfully'
        }
      }
    }
  }, async (req, reply) => {
    try {
      if (await WIKI.models.sites.deleteSite(req.params.siteId)) {
        reply.code(204)
      } else {
        reply.badRequest('Site does not exist.')
      }
    } catch (err) {
      reply.send(err)
    }
  })
}

export default routes
