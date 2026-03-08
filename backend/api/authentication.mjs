
/**
 * Authentication API Routes
 */
async function routes (app, options) {
  /**
   * GET SITE AUTHENTICATION STRATEGIES
   */
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
    const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
    const activeStrategies = await WIKI.models.authentication.getStrategies({ enabledOnly: true })
    const siteStrategies = activeStrategies.map(str => {
      const authModule = WIKI.data.authentication.find(m => m.key === str.module)
      const siteStr = site.config.authStrategies.find(s => s.id === str.id) || {}
      return {
        id: str.id,
        displayName: str.displayName,
        useForm: authModule.useForm,
        usernameType: authModule.usernameType,
        color: authModule.color,
        icon: authModule.icon,
        order: siteStr.order ?? 0,
        isVisible: siteStr.isVisible ?? false
      }
    }).sort((a,b) => a.order - b.order)
    return req.query.visibleOnly ? siteStrategies.filter(s => s.isVisible) : siteStrategies
  })

  /**
   * LOGIN USING USER/PASS
   */
  app.post('/sites/:siteId/auth/login', {
    schema: {
      summary: 'Login',
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
      body: {
        type: 'object',
        required: ['strategyId', 'username', 'password'],
        properties: {
          strategyId: {
            type: 'string',
            format: 'uuid'
          },
          username: {
            type: 'string',
            minLength: 1,
            maxLength: 255
          },
          password: {
            type: 'string',
            minLength: 1,
            maxLength: 255
          }
        }
      }
    }
  }, async (req, reply) => {
    return WIKI.models.users.login({
      siteId: req.params.siteId,
      strategyId: req.body.strategyId,
      username: req.body.username,
      password: req.body.password,
      ip: req.ip
    })
  })
}

export default routes
