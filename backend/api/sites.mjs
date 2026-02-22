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

  /**
   * CREATE SITE
   */
  app.post('/', {
    config: {
      // permissions: ['create:sites', 'manage:sites']
    },
    schema: {
      summary: 'Create a new site',
      tags: ['Sites'],
      body: {
        type: 'object',
        required: ['hostname', 'title'],
        properties: {
          hostname: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            pattern: '^(\\*|[a-z0-9.-]+)$'
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 255
          }
        },
        examples: [
          {
            hostname: 'wiki.example.org',
            title: 'My Wiki Site'
          }
        ]
      },
      response: {
        200: {
          description: 'Site created successfully',
          type: 'object',
          properties: {
            message: {
              type: 'string'
            },
            id: {
              type: 'string',
              format: 'uuid'
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const result = await WIKI.models.sites.createSite(req.body.hostname, { title: req.body.title })
    return {
      message: 'Site created successfully.',
      id: result.id
    }
  })

  /**
   * UPDATE SITE
   */
  app.put('/:siteId', {
    config: {
      permissions: ['manage:sites']
    },
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
    config: {
      permissions: ['manage:sites']
    },
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
      if (await WIKI.models.sites.countSites() <= 1) {
        reply.conflict('Cannot delete the last site. At least 1 site must exist at all times.')
      } else if (await WIKI.models.sites.deleteSite(req.params.siteId)) {
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
