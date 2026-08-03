import { nanoid } from 'nanoid'
import { limitAuthAttempts } from '../helpers/rateLimit.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'

/**
 * How long a redirect login may take before its callback is refused.
 *
 * Long enough for somebody to be asked for a password and a second factor at the provider, short
 * enough that a `state` left lying around in a URL somewhere is no longer worth anything.
 */
const AUTH_FLOW_MINUTES = 15

/**
 * Where a provider sends the browser back, as an absolute URL.
 *
 * Built from the request rather than stored, so an instance reachable on more than one hostname keeps
 * working — but it has to match what the administrator registered with the provider, which is why the
 * admin area shows this exact shape on the strategy's page.
 */
function callbackUrl(req: FastifyRequest, strategyId: string): string {
  return `${req.protocol}://${req.host}/_api/auth/${strategyId}/callback`
}

/**
 * The login screen, carrying what went wrong.
 *
 * A redirect login fails at the provider or on the way back, where there is no request left to answer
 * with an error — so the browser is sent to the login screen with a code it can put in front of the
 * user, and `redirect` is preserved so that a successful second attempt still lands where the first
 * one was going.
 */
function loginErrorUrl(redirect: string, code: string): string {
  const params = new URLSearchParams({ error: code })
  if (redirect && redirect !== '/') {
    params.set('redirect', redirect)
  }
  return `/login?${params.toString()}`
}

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
      config: {
        publicAccess: true
      },
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
      config: {
        publicAccess: true
      },
      // -> Guessing is what this endpoint is attacked with; see `helpers/rateLimit.ts`
      onRequest: limitAuthAttempts,
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
        },
        response: {
          200: { $ref: 'AuthLoginResult#' }
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
      config: {
        publicAccess: true
      },
      // -> Guessing is what this endpoint is attacked with; see `helpers/rateLimit.ts`
      onRequest: limitAuthAttempts,
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
        },
        response: {
          200: { $ref: 'AuthLoginResult#' }
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
   * SUBMIT A 2FA CODE
   *
   * The other half of a login that answered `provideTfa` or `setupTfa`: the continuation token stands
   * for the login that got that far, and the code proves the second factor. With `setup`, a correct
   * code also activates the secret the login generated, which is how an account that is required to
   * use 2FA gets it configured.
   */
  app.put<{
    Params: { siteId: string }
    Body: {
      strategyId: string
      continuationToken: string
      securityCode: string
      setup?: boolean
    }
  }>(
    '/sites/:siteId/auth/tfa',
    {
      config: {
        publicAccess: true
      },
      // -> Guessing is what this endpoint is attacked with; see `helpers/rateLimit.ts`
      onRequest: limitAuthAttempts,
      schema: {
        summary: 'Submit a 2FA Security Code From Login',
        description:
          'Answers like the login route does, since the same checks continue afterwards: a user who also owes a password change is asked for one next. A wrong code can be retried a few times before the continuation token is discarded and the login has to be started again.',
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
        body: {
          type: 'object',
          required: ['strategyId', 'continuationToken', 'securityCode'],
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
            securityCode: {
              type: 'string',
              pattern: '^[0-9]{6}$',
              description: 'The six digits shown by the authenticator app.'
            },
            setup: {
              type: 'boolean',
              default: false,
              description:
                'True when answering a `setupTfa` login, i.e. the code confirms a secret that was just generated.'
            }
          }
        },
        response: {
          200: { $ref: 'AuthLoginResult#' }
        }
      }
    },
    async (req, reply) => {
      try {
        const result = await WIKI.models.users.loginTFA(
          {
            siteId: req.params.siteId,
            strategyId: req.body.strategyId,
            continuationToken: req.body.continuationToken,
            securityCode: req.body.securityCode,
            setup: req.body.setup ?? false,
            ip: req.ip
          },
          req
        )
        return {
          ok: true,
          ...result
        }
      } catch (err: any) {
        if (err.message.startsWith('ERR_')) {
          WIKI.models.flags.authDebug(`2FA verification rejected: ${err.message}`)
          return reply.badRequest(err.message)
        } else {
          WIKI.logger.debug(err)
          WIKI.models.flags.authDebug(`2FA verification failed unexpectedly: ${err.message}`)
          return reply.badRequest('ERR_TFA_FAILED')
        }
      }
    }
  )

  /**
   * REQUEST A PASSKEY CHALLENGE
   *
   * Takes no identity: a passkey says which account it belongs to, so there is nobody to name until the
   * assertion comes back. The challenge is remembered on the session.
   */
  app.post<{ Params: { siteId: string } }>(
    '/sites/:siteId/auth/passkey/challenge',
    {
      config: {
        publicAccess: true
      },
      // -> Guessing is what this endpoint is attacked with; see `helpers/rateLimit.ts`
      onRequest: limitAuthAttempts,
      schema: {
        summary: 'Get the options for logging in with a passkey',
        description:
          "Pass the result to the browser's WebAuthn API, then send what the authenticator produces to `PUT /sites/:siteId/auth/passkey/login`. No credential list is sent and no user is named: passkeys are registered as discoverable credentials, so the authenticator offers whichever ones it holds for this hostname and the assertion identifies the account.",
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
            description: 'Passkey challenge generated',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              authOptions: {
                type: 'object',
                additionalProperties: true,
                description: 'A WebAuthn `PublicKeyCredentialRequestOptions`, JSON-encoded.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      try {
        const { authOptions, pending } = await WIKI.models.passkeys.startLogin({
          hostname: req.hostname,
          origin: req.headers.origin
        })
        req.session.passkeyLogin = pending
        return {
          ok: true,
          authOptions
        }
      } catch (err: any) {
        if (err.message.startsWith('ERR_')) {
          return reply.badRequest(err.message)
        } else {
          WIKI.logger.debug(err)
          return reply.badRequest('ERR_LOGIN_FAILED')
        }
      }
    }
  )

  /**
   * LOGIN USING A PASSKEY
   */
  app.put<{ Params: { siteId: string }; Body: { authResponse: Record<string, any> } }>(
    '/sites/:siteId/auth/passkey/login',
    {
      config: {
        publicAccess: true
      },
      // -> Guessing is what this endpoint is attacked with; see `helpers/rateLimit.ts`
      onRequest: limitAuthAttempts,
      schema: {
        summary: 'Login With a Passkey',
        description:
          'Verifies what the authenticator signed and, if it holds up, logs the user in. A passkey establishes both identity and presence, so no password or 2FA code is asked for on top of it.',
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
        body: {
          type: 'object',
          required: ['authResponse'],
          properties: {
            authResponse: {
              type: 'object',
              additionalProperties: true,
              description: "The browser's WebAuthn authentication response, JSON-encoded."
            }
          }
        },
        response: {
          200: { $ref: 'AuthLoginResult#' }
        }
      }
    },
    async (req, reply) => {
      try {
        const result = await WIKI.models.passkeys.verifyLogin(
          {
            authResponse: req.body.authResponse as any,
            pending: req.session.passkeyLogin,
            ip: req.ip
          },
          req
        )
        return {
          ok: true,
          ...result
        }
      } catch (err: any) {
        if (err.message.startsWith('ERR_')) {
          return reply.badRequest(err.message)
        } else {
          WIKI.logger.debug(err)
          WIKI.models.flags.authDebug(`Passkey login failed unexpectedly: ${err.message}`)
          return reply.badRequest('ERR_LOGIN_FAILED')
        }
      } finally {
        // -> Spent either way: a rejected assertion does not get a second go at the same challenge
        req.session.passkeyLogin = undefined
      }
    }
  )

  /**
   * START A REDIRECT LOGIN
   */
  app.get<{
    Params: { strategyId: string }
    Querystring: { siteId?: string; redirect?: string }
  }>(
    '/auth/:strategyId/authorize',
    {
      config: {
        publicAccess: true
      },
      schema: {
        summary: 'Start a login at an identity provider',
        description:
          'Answers with a redirect to the provider, for a strategy whose module signs users in there rather than through a form — OpenID Connect, Google, GitHub. The `state`, `nonce` and PKCE verifier that tie the answer back to this browser are generated here and kept on the session; the browser is never trusted with any of them.\n\nOpened by following the link, not by fetching it: what comes back is a page at the provider.',
        tags: ['Authentication'],
        params: {
          type: 'object',
          properties: {
            strategyId: { type: 'string', format: 'uuid' }
          },
          required: ['strategyId']
        },
        querystring: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            redirect: {
              type: 'string',
              maxLength: 255,
              description:
                'Where to send the user once they are logged in. A path on this wiki; anything else is ignored.'
            }
          }
        },
        response: {
          302: { description: 'Redirect to the identity provider', type: 'null' }
        }
      }
    },
    async (req, reply) => {
      const strategy = await WIKI.models.authentication.getStrategyById(req.params.strategyId)
      const instance = WIKI.auth.strategies[req.params.strategyId] as any
      if (!strategy?.isEnabled || typeof instance?.authorizationUrl !== 'function') {
        return reply.notFound('There is no such login provider.')
      }

      const siteId = req.query.siteId ?? WIKI.sitesMappings[req.hostname] ?? ''
      const flow = {
        strategyId: strategy.id,
        siteId,
        state: nanoid(32),
        nonce: nanoid(32),
        codeVerifier: nanoid(64),
        // -> Only a path on this wiki: an open redirect is how a login page is turned into a lure
        redirect: (req.query.redirect ?? '').startsWith('/') ? req.query.redirect! : '/',
        startedAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' })
      }
      req.session.authFlow = flow

      try {
        const url = await instance.authorizationUrl({
          redirectUri: callbackUrl(req, strategy.id),
          state: flow.state,
          nonce: flow.nonce,
          codeVerifier: flow.codeVerifier
        })
        WIKI.models.flags.authDebug(
          `Redirecting to ${strategy.module} provider for strategy ${strategy.id} from ${req.ip}`
        )
        return reply.redirect(url)
      } catch (err: any) {
        WIKI.logger.warn(`Could not start a login at ${strategy.module}: ${err.message}`)
        return reply.redirect(loginErrorUrl(flow.redirect, err.message))
      }
    }
  )

  /**
   * FINISH A REDIRECT LOGIN
   */
  app.get<{
    Params: { strategyId: string }
    Querystring: { code?: string; state?: string; error?: string; error_description?: string }
  }>(
    '/auth/:strategyId/callback',
    {
      config: {
        publicAccess: true
      },
      // -> A callback is a password check by another name: whatever it carries decides who is logged in
      onRequest: limitAuthAttempts,
      schema: {
        summary: 'Finish a login at an identity provider',
        description:
          "Where the provider sends the browser back. The answer is only accepted if it matches the flow this session started — same strategy, same `state`, and within the time a login takes — after which the module turns the code into an account and the session is established. Ends in a redirect either way: to where the login was heading, or to the login screen carrying an error code.\n\nThis is the URL an administrator registers with the provider; it is shown on the strategy's own page in the admin area.",
        tags: ['Authentication'],
        params: {
          type: 'object',
          properties: {
            strategyId: { type: 'string', format: 'uuid' }
          },
          required: ['strategyId']
        },
        response: {
          302: { description: 'Redirect back into the wiki', type: 'null' }
        }
      }
    },
    async (req, reply) => {
      const flow = req.session.authFlow
      const redirect = flow?.redirect ?? '/'
      /*
        Everything about the answer is checked against the flow this session started. A callback that
        arrives with no flow behind it, for another strategy, with a different `state`, or long after
        the login began is not this session's login — and is refused without the code being spent.
      */
      if (
        !flow ||
        flow.strategyId !== req.params.strategyId ||
        !req.query.state ||
        req.query.state !== flow.state ||
        Temporal.Instant.compare(
          Temporal.Instant.from(flow.startedAt).add({ minutes: AUTH_FLOW_MINUTES }),
          Temporal.Now.instant()
        ) < 0
      ) {
        WIKI.models.flags.authDebug(
          `Callback for strategy ${req.params.strategyId} from ${req.ip} did not match this session's login`
        )
        req.session.authFlow = undefined
        return reply.redirect(loginErrorUrl(redirect, 'ERR_LOGIN_EXPIRED'))
      }
      // -> Spent, whatever happens next: one callback per login
      req.session.authFlow = undefined

      if (req.query.error) {
        WIKI.models.flags.authDebug(
          `Provider refused the login for strategy ${flow.strategyId}: ${req.query.error} ${req.query.error_description ?? ''}`
        )
        return reply.redirect(loginErrorUrl(redirect, 'ERR_LOGIN_FAILED'))
      }

      const strategy = await WIKI.models.authentication.getStrategyById(flow.strategyId)
      const instance = WIKI.auth.strategies[flow.strategyId] as any
      if (!strategy?.isEnabled || typeof instance?.profile !== 'function') {
        return reply.redirect(loginErrorUrl(redirect, 'ERR_LOGIN_FAILED'))
      }

      try {
        const profile = await instance.profile({
          redirectUri: callbackUrl(req, strategy.id),
          state: flow.state,
          nonce: flow.nonce,
          codeVerifier: flow.codeVerifier,
          currentUrl: `${callbackUrl(req, strategy.id)}?${new URLSearchParams(req.query as Record<string, string>).toString()}`,
          code: req.query.code
        })
        const result = await WIKI.models.users.loginWithProvider(
          { siteId: flow.siteId, strategy, profile, ip: req.ip },
          req
        )
        return reply.redirect(result.redirect || redirect)
      } catch (err: any) {
        WIKI.models.flags.authDebug(
          `Login through ${strategy.module} strategy ${strategy.id} failed: ${err.message}`
        )
        return reply.redirect(loginErrorUrl(redirect, err.message))
      }
    }
  )

  /**
   * LOGOUT
   */
  app.post<{ Params: { siteId: string } }>(
    '/sites/:siteId/auth/logout',
    {
      config: {
        publicAccess: true
      },
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
          allOf: [{ $ref: 'AuthStrategyInput#' }, { type: 'object', required: ['module'] }]
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
