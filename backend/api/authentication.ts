import type { FastifyInstance } from 'fastify'

/**
 * Authentication API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * GET SITE AUTHENTICATION STRATEGIES
   */
  app.get<{ Params: { siteId: string }; Querystring: { visibleOnly?: boolean } }>(
    '/sites/:siteId/auth/strategies',
    {
      schema: {
        summary: 'List all site authentication strategies',
        description:
          'Ordered by the position configured for the site. `activeStrategy` holds the per-instance settings, nested under it `strategy` holds the module definition.',
        tags: ['Authentication'],
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
        querystring: {
          type: 'object',
          properties: {
            visibleOnly: {
              type: 'boolean',
              default: false
            }
          }
        },
        response: {
          200: {
            description: 'List of site authentication strategies',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                order: {
                  type: 'integer'
                },
                isVisible: {
                  type: 'boolean'
                },
                activeStrategy: {
                  type: 'object',
                  properties: {
                    displayName: {
                      type: 'string'
                    },
                    registration: {
                      type: 'boolean'
                    },
                    strategy: {
                      type: 'object',
                      properties: {
                        key: {
                          type: 'string'
                        },
                        title: {
                          type: 'string'
                        },
                        icon: {
                          type: 'string'
                        },
                        color: {
                          type: 'string'
                        },
                        useForm: {
                          type: 'boolean'
                        },
                        usernameType: {
                          type: 'string'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.badRequest('Invalid Site ID')
      }
      const activeStrategies = await WIKI.models.authentication.getStrategies({ enabledOnly: true })
      // -> A site created before it had strategies configured has no list at all
      const configuredStrategies = site.config.authStrategies ?? []
      const siteStrategies = activeStrategies
        .map((str: any) => {
          const authModule = WIKI.data.authentication.find((m: any) => m.key === str.module)
          const siteStr = configuredStrategies.find((s: any) => s.id === str.id) || {}
          return {
            id: str.id,
            order: siteStr.order ?? 0,
            isVisible: siteStr.isVisible ?? false,
            activeStrategy: {
              displayName: str.displayName,
              registration: str.registration,
              strategy: {
                key: authModule?.key ?? str.module,
                title: authModule?.title ?? str.module,
                icon: authModule?.icon ?? '',
                color: authModule?.color ?? 'primary',
                useForm: authModule?.useForm ?? false,
                usernameType: authModule?.usernameType ?? 'email'
              }
            }
          }
        })
        .sort((a: any, b: any) => a.order - b.order)
      return req.query.visibleOnly ? siteStrategies.filter((s: any) => s.isVisible) : siteStrategies
    }
  )

  /**
   * LOGIN USING USER/PASS
   */
  app.put<{
    Params: { siteId: string }
    Body: { strategyId: string; username?: string; password?: string }
  }>(
    '/sites/:siteId/auth/login',
    {
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
          required: ['strategyId'],
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
    },
    async (req, reply) => {
      try {
        const result = await WIKI.models.users.login(
          {
            siteId: req.params.siteId,
            strategyId: req.body.strategyId,
            username: req.body.username,
            password: req.body.password,
            ip: req.ip
          },
          req
        )
        if (!result) {
          throw new Error('Unexpected empty login response.')
        }
        return {
          ok: true,
          ...result
        }
      } catch (err: any) {
        if (err.message.startsWith('ERR_')) {
          return reply.badRequest(err.message)
        } else {
          WIKI.logger.info(err) // TODO: change to debug once stable
          return reply.badRequest('ERR_LOGIN_FAILED')
        }
      }
    }
  )

  /**
   * CHANGE PASSWORD
   */
  app.put<{
    Params: { siteId: string }
    Body: { strategyId: string; continuationToken: string; newPassword: string }
  }>(
    '/sites/:siteId/auth/changePassword',
    {
      schema: {
        summary: 'Change Password From Login',
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
          required: ['strategyId', 'continuationToken', 'newPassword'],
          properties: {
            strategyId: {
              type: 'string',
              format: 'uuid'
            },
            continuationToken: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            },
            newPassword: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          }
        }
      }
    },
    async (req, reply) => {
      try {
        const result = await WIKI.models.users.loginChangePassword(
          {
            siteId: req.params.siteId,
            strategyId: req.body.strategyId,
            continuationToken: req.body.continuationToken,
            newPassword: req.body.newPassword,
            ip: req.ip
          },
          req
        )
        if (!result) {
          throw new Error('Unexpected empty change password response.')
        }
        if (result?.authenticated) {
          req.session.authenticated = true
        }
        return {
          ok: true,
          ...result
        }
      } catch (err: any) {
        if (err.message.startsWith('ERR_')) {
          return reply.badRequest(err.message)
        } else {
          WIKI.logger.debug(err)
          return reply.badRequest('ERR_CHANGE_PASSWORD_FAILED')
        }
      }
    }
  )
}

export default routes
