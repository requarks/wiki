/**
 * Pages API Routes
 */
async function routes(app, options) {
  app.get(
    '/sites/:siteId/pages',
    {
      config: {
        permissions: ['read:pages', 'manage:pages']
      },
      schema: {
        summary: 'List all pages',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          }
        }
      }
    },
    async (req, reply) => {
      return []
    }
  )

  app.get(
    '/sites/:siteId/pages/:pageIdOrHash',
    {
      schema: {
        summary: 'Get a single page',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            pageIdOrHash: {
              type: 'string',
              oneOf: [{ format: 'uuid' }, { pattern: '^[a-f0-9]+$' }]
            }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            withContent: {
              type: 'boolean',
              default: false
            }
          }
        }
      }
    },
    async (req, reply) => {
      return []
    }
  )

  app.post(
    '/sites/:siteId/pages/userPermissions',
    {
      schema: {
        summary: 'Get page user permissions',
        tags: ['Pages'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          }
        },
        body: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          },
          examples: [
            {
              path: 'foo/bar'
            }
          ]
        }
      }
    },
    async (req, reply) => {
      return []
    }
  )
}

export default routes
