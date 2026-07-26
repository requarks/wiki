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
          // -> An unexpected failure, reported to the client as a generic one. The detail is behind
          //    the authDebug flag rather than logged on every failed login.
          WIKI.logger.debug(err)
          WIKI.models.flags.authDebug(`Login failed unexpectedly: ${err.message}`)
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
          WIKI.models.flags.authDebug(`Password change from login rejected: ${err.message}`)
          return reply.badRequest(err.message)
        } else {
          WIKI.logger.debug(err)
          WIKI.models.flags.authDebug(`Password change from login failed: ${err.message}`)
          return reply.badRequest('ERR_CHANGE_PASSWORD_FAILED')
        }
      }
    }
  )

  /**
   * LOGOUT
   */
  app.post<{ Params: { siteId: string } }>(
    '/sites/:siteId/auth/logout',
    {
      schema: {
        summary: 'Logout',
        description:
          "Destroys the current session and answers with where to send the user next: the first of the user's groups that sets a logout redirect, otherwise the site's own setting, otherwise the site root. A request that was not logged in gets the same answer rather than an error, so that a client acting on a session the server has already forgotten still ends up somewhere sensible.",
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
        response: {
          200: {
            description: 'Logged out successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              redirect: {
                type: 'string',
                description: 'A path within this wiki, or an absolute URL if one is configured.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const user = req.session?.authenticated ? req.session.user : null

      // -> Resolved before the session goes away, since it depends on who was logged in
      const redirect = await WIKI.models.users.getLogoutRedirect(
        user?.id ?? null,
        req.params.siteId
      )

      if (req.session) {
        // -> Drops the stored session, so the cookie the browser still holds refers to nothing
        await req.session.destroy()
      }
      // -> And clear that cookie too: `destroy()` detaches the session, which leaves the plugin's own
      //    save hook with nothing to do. Name and options match the registration in `index.ts`.
      reply.clearCookie('wikiSession')

      if (user) {
        WIKI.models.flags.authDebug(
          `User ${user.id} <${user.email}> logged out, redirecting to ${redirect}`
        )
        await WIKI.models.hooks.emit('user:logout', {
          userId: user.id,
          ip: req.ip,
          metadata: {
            name: user.name,
            email: user.email
          }
        })
      }

      return {
        ok: true,
        redirect
      }
    }
  )

  /**
   * LIST AUTHENTICATION MODULES
   */
  app.get(
    '/authentication/modules',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the authentication modules available on this server',
        description:
          'Read from `modules/authentication` at startup, so installing a module means dropping it on disk and restarting. Modules that declare themselves unavailable are not listed.',
        tags: ['Authentication'],
        response: {
          200: {
            description: 'List of authentication modules',
            type: 'array',
            items: { $ref: 'AuthModule#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.authentication.getModules()
    }
  )

  /**
   * LIST CONFIGURED STRATEGIES
   */
  app.get(
    '/authentication/strategies',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the configured authentication strategies',
        description:
          'Instance-wide, i.e. every strategy regardless of which sites offer it. Which of them a given site shows on its login screen, and in what order, is part of that site’s configuration. Configuration values include any secrets a module stores, hence the `manage:system` requirement.',
        tags: ['Authentication'],
        response: {
          200: {
            description: 'List of configured strategies',
            type: 'array',
            items: { $ref: 'AuthStrategy#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.authentication.getActiveStrategies()
    }
  )

  /**
   * GET CONFIGURED STRATEGY
   */
  app.get<{ Params: { strategyId: string } }>(
    '/authentication/strategies/:strategyId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Get a single configured authentication strategy',
        tags: ['Authentication'],
        params: {
          type: 'object',
          properties: {
            strategyId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['strategyId']
        },
        response: {
          200: { $ref: 'AuthStrategy#' }
        }
      }
    },
    async (req, reply) => {
      const strategy = await WIKI.models.authentication.getStrategyById(req.params.strategyId)
      if (!strategy) {
        return reply.notFound('Authentication strategy does not exist.')
      }
      return strategy
    }
  )

  /**
   * CREATE STRATEGY
   */
  app.post<{ Body: Record<string, any> }>(
    '/authentication/strategies',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Configure a new authentication strategy',
        description:
          'A module can be configured more than once, so that two instances of the same provider can coexist. A new strategy is not offered by any site until that site adds it to its login screen.',
        tags: ['Authentication'],
        body: {
          allOf: [{ $ref: 'AuthStrategyInput#' }, { required: ['module'] }]
        },
        response: {
          200: {
            description: 'Strategy created successfully',
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
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const mod = WIKI.models.authentication.getModule(req.body.module)
      if (!mod) {
        return reply.badRequest(`There is no authentication module named "${req.body.module}".`)
      }

      const invalid =
        (await WIKI.models.authentication.validateStrategy({
          module: req.body.module,
          displayName: req.body.displayName,
          isEnabled: req.body.isEnabled,
          allowedEmailRegex: req.body.allowedEmailRegex,
          autoEnrollGroups: req.body.autoEnrollGroups
        })) ?? WIKI.models.authentication.validateConfig(req.body.module, req.body.config)
      if (invalid) {
        return reply.badRequest(invalid)
      }

      const id = await WIKI.models.authentication.createStrategy(req.body as any)

      return {
        ok: true,
        message: 'Authentication strategy created successfully.',
        id
      }
    }
  )

  /**
   * UPDATE STRATEGY
   */
  app.put<{ Params: { strategyId: string }; Body: Record<string, any> }>(
    '/authentication/strategies/:strategyId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Update an authentication strategy',
        description:
          'Accepts any subset of the fields, except `module`, which is fixed once a strategy exists. The strategies are reloaded on success, so a configuration change applies to the next login rather than after a restart.',
        tags: ['Authentication'],
        params: {
          type: 'object',
          properties: {
            strategyId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['strategyId']
        },
        body: { $ref: 'AuthStrategyInput#' },
        response: {
          200: {
            description: 'Strategy updated successfully',
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
      const current = await WIKI.models.authentication.getStrategyById(req.params.strategyId)
      if (!current) {
        return reply.notFound('Authentication strategy does not exist.')
      }
      if (req.body.module !== undefined && req.body.module !== current.module) {
        return reply.badRequest('The module of an existing strategy cannot be changed.')
      }

      const patch: Record<string, any> = {}
      for (const field of [
        'displayName',
        'isEnabled',
        'registration',
        'allowedEmailRegex',
        'autoEnrollGroups',
        'config'
      ] as const) {
        if (req.body[field] !== undefined) {
          patch[field] = req.body[field]
        }
      }
      if (Object.keys(patch).length < 1) {
        return reply.badRequest('No strategy fields provided to update.')
      }

      const invalid =
        (await WIKI.models.authentication.validateStrategy({
          id: current.id,
          module: current.module,
          ...patch
        })) ?? WIKI.models.authentication.validateConfig(current.module, patch.config)
      if (invalid) {
        return reply.badRequest(invalid)
      }

      if (!(await WIKI.models.authentication.updateStrategy(req.params.strategyId, patch))) {
        return reply.internalServerError('Failed to update the authentication strategy.')
      }

      return {
        ok: true,
        message: 'Authentication strategy updated successfully.'
      }
    }
  )

  /**
   * DELETE STRATEGY
   */
  app.delete<{ Params: { strategyId: string } }>(
    '/authentication/strategies/:strategyId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Delete an authentication strategy',
        description:
          'Also removes it from every site’s login screen. The built-in local strategy cannot be deleted: every account stores its password under that strategy ID, so removing it would leave no way in.',
        tags: ['Authentication'],
        params: {
          type: 'object',
          properties: {
            strategyId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['strategyId']
        },
        response: {
          204: {
            description: 'Strategy deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const strategy = await WIKI.models.authentication.getStrategyById(req.params.strategyId)
      if (!strategy) {
        return reply.notFound('Authentication strategy does not exist.')
      }
      if (strategy.id === WIKI.data.systemIds.localAuthId) {
        return reply.conflict('The built-in local strategy cannot be deleted.')
      }

      await WIKI.models.authentication.deleteStrategy(req.params.strategyId)
      return reply.code(204).send()
    }
  )
}

export default routes
