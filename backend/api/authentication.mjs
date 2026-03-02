/**
 * Authentication API Routes
 */
async function routes (app, options) {
  app.get('/sites/:siteId/auth/strategies', {
    schema: {
      summary: 'List all site authentication strategies',
      tags: ['Authentication'],
      params: {
        type: 'object',
        properties: {
          siteId: {
            type: 'string',
            format: 'uuid'
          }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          visibleOnly: {
            type: 'boolean',
            default: false
          }
        }
      }
    }
  }, async (req, reply) => {
    return []
  })

  app.post('/auth/login', {
    schema: {
      summary: 'Login',
      tags: ['Authentication'],
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
  }, async (req, reply) => {
    return []
  })
}

export default routes
