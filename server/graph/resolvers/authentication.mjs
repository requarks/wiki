import _ from 'lodash-es'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import jwt from 'jsonwebtoken'
import ms from 'ms'
import { DateTime } from 'luxon'
import base64 from '@hexagon/base64'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server'

export default {
  Query: {
    /**
     * List of API Keys
     */
    async apiKeys (obj, args, context) {
      const keys = await WIKI.db.apiKeys.query().orderBy(['isRevoked', 'name'])
      return keys.map(k => ({
        id: k.id,
        name: k.name,
        keyShort: '...' + k.key.substring(k.key.length - 20),
        isRevoked: k.isRevoked,
        expiration: k.expiration,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
      }))
    },
    /**
     * Current API State
     */
    apiState () {
      return WIKI.config.api.isEnabled
    },
    /**
     * Fetch authentication strategies
     */
    async authStrategies () {
      return WIKI.data.authentication.map(stg => ({
        ...stg,
        isAvailable: stg.isAvailable === true
      }))
    },
    /**
     * Fetch active authentication strategies
     */
    async authActiveStrategies (obj, args, context) {
      const strategies = await WIKI.db.authentication.getStrategies({ enabledOnly: args.enabledOnly })
      return strategies.map(a => {
        const str = _.find(WIKI.data.authentication, ['key', a.module]) || {}
        return {
          ...a,
          config: _.transform(str.props, (r, v, k) => {
            r[k] = v.sensitive ? '********' : a.config[k]
          }, {})
        }
      })
    },
    /**
     * Fetch site authentication strategies
     */
    async authSiteStrategies (obj, args, context, info) {
      const site = await WIKI.db.sites.query().findById(args.siteId)
      const activeStrategies = await WIKI.db.authentication.getStrategies({ enabledOnly: true })
      const siteStrategies = _.sortBy(activeStrategies.map(str => {
        const siteAuth = _.find(site.config.authStrategies, ['id', str.id]) || {}
        return {
          id: str.id,
          activeStrategy: str,
          order: siteAuth.order ?? 0,
          isVisible: siteAuth.isVisible ?? false
        }
      }), ['order'])
      return args.visibleOnly ? siteStrategies.filter(s => s.isVisible) : siteStrategies
    }
  },
  Mutation: {
    /**
     * Create New API Key
     */
    async createApiKey (obj, args, context) {
      try {
        const key = await WIKI.db.apiKeys.createNewKey(args)
        await WIKI.auth.reloadApiKeys()
        WIKI.events.outbound.emit('reloadApiKeys')
        return {
          key,
          operation: generateSuccess('API Key created successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    },
    /**
     * Perform Login
     */
    async login (obj, args, context) {
      try {
        const authResult = await WIKI.db.users.login(args, context)
        return {
          ...authResult,
          operation: generateSuccess('Login success')
        }
      } catch (err) {
        // LDAP Debug Flag
        if (args.strategy === 'ldap' && WIKI.config.flags.ldapdebug) {
          WIKI.logger.warn('LDAP LOGIN ERROR (c1): ', err)
        }
        WIKI.logger.debug(err)

        return generateError(err)
      }
    },
    /**
     * Perform 2FA Login
     */
    async loginTFA (obj, args, context) {
      try {
        const authResult = await WIKI.db.users.loginTFA(args, context)
        return {
          ...authResult,
          operation: generateSuccess('TFA success')
        }
      } catch (err) {
        WIKI.logger.debug(err)
        return generateError(err)
      }
    },
    /**
     * Setup TFA
     */
    async setupTFA (obj, args, context) {
      try {
        const userId = context.req.user?.id
        if (!userId) {
          throw new Error('ERR_USER_NOT_AUTHENTICATED')
        }

        const usr = await WIKI.db.users.query().findById(userId)
        if (!usr) {
          throw new Error('ERR_INVALID_USER')
        }

        const str = WIKI.auth.strategies[args.strategyId]
        if (!str) {
          throw new Error('ERR_INVALID_STRATEGY')
        }

        if (!usr.auth[args.strategyId]) {
          throw new Error('ERR_INVALID_STRATEGY')
        }

        if (usr.auth[args.strategyId].tfaIsActive) {
          throw new Error('ERR_TFA_ALREADY_ACTIVE')
        }

        const tfaQRImage = await usr.generateTFA(args.strategyId, args.siteId)
        const tfaToken = await WIKI.db.userKeys.generateToken({
          kind: 'tfaSetup',
          userId: usr.id,
          meta: {
            strategyId: args.strategyId
          }
        })

        return {
          operation: generateSuccess('TFA setup started'),
          continuationToken: tfaToken,
          tfaQRImage
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Deactivate 2FA
     */
    async deactivateTFA (obj, args, context) {
      try {
        const userId = context.req.user?.id
        if (!userId) {
          throw new Error('ERR_USER_NOT_AUTHENTICATED')
        }

        const usr = await WIKI.db.users.query().findById(userId)
        if (!usr) {
          throw new Error('ERR_INVALID_USER')
        }

        const str = WIKI.auth.strategies[args.strategyId]
        if (!str) {
          throw new Error('ERR_INVALID_STRATEGY')
        }

        if (!usr.auth[args.strategyId]) {
          throw new Error('ERR_INVALID_STRATEGY')
        }

        if (!usr.auth[args.strategyId].tfaIsActive) {
          throw new Error('ERR_TFA_NOT_ACTIVE')
        }

        usr.auth[args.strategyId].tfaIsActive = false
        usr.auth[args.strategyId].tfaSecret = null

        await usr.$query().patch({
          auth: usr.auth
        })

        return {
          operation: generateSuccess('TFA deactivated successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Setup Passkey
     */
    async setupPasskey (obj, args, context) {
      try {
        const userId = context.req.user?.id
        if (!userId) {
          throw new Error('ERR_USER_NOT_AUTHENTICATED')
        }

        const usr = await WIKI.db.users.query().findById(userId)
        if (!usr) {
          throw new Error('ERR_INVALID_USER')
        }

        const site = WIKI.sites[args.siteId]
        if (!site) {
          throw new Error('ERR_INVALID_SITE')
        } else if (site.hostname === '*') {
          WIKI.logger.warn('Cannot use passkeys with a wildcard site hostname. Enter a valid hostname under the Administration Area > General.')
          throw new Error('ERR_PK_HOSTNAME_MISSING')
        }

        const options = await generateRegistrationOptions({
          rpName: site.config.title,
          rpId: site.hostname,
          userID: usr.id,
          userName: usr.email,
          userDisplayName: usr.name,
          attestationType: 'none',
          authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred'
          },
          excludeCredentials: usr.passkeys.authenticators?.map(authenticator => ({
            id: new Uint8Array(authenticator.credentialID),
            type: 'public-key',
            transports: authenticator.transports
          })) ?? []
        })

        usr.passkeys.reg = {
          challenge: options.challenge,
          rpId: site.hostname,
          siteId: site.id
        }

        await usr.$query().patch({
          passkeys: usr.passkeys
        })

        return {
          operation: generateSuccess('Passkey registration options generated successfully.'),
          registrationOptions: options
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Finalize Passkey Registration
     */
    async finalizePasskey (obj, args, context) {
      try {
        const userId = context.req.user?.id
        if (!userId) {
          throw new Error('ERR_USER_NOT_AUTHENTICATED')
        }

        const usr = await WIKI.db.users.query().findById(userId)
        if (!usr) {
          throw new Error('ERR_INVALID_USER')
        } else if (!usr.passkeys?.reg) {
          throw new Error('ERR_PASSKEY_NOT_SETUP')
        }

        if (!args.name || args.name.trim().length < 1 || args.name.length > 255) {
          throw new Error('ERR_PK_NAME_MISSING_OR_INVALID')
        }

        const verification = await verifyRegistrationResponse({
          response: args.registrationResponse,
          expectedChallenge: usr.passkeys.reg.challenge,
          expectedOrigin: `https://${usr.passkeys.reg.rpId}`,
          expectedRPID: usr.passkeys.reg.rpId,
          requireUserVerification: true
        })

        if (!verification.verified) {
          throw new Error('ERR_PK_VERIFICATION_FAILED')
        }

        if (!usr.passkeys.authenticators) {
          usr.passkeys.authenticators = []
        }
        usr.passkeys.authenticators.push({
          ...verification.registrationInfo,
          id: base64.fromArrayBuffer(verification.registrationInfo.credentialID, true),
          createdAt: new Date(),
          name: args.name,
          siteId: usr.passkeys.reg.siteId,
          transports: args.registrationResponse.response.transports
        })

        delete usr.passkeys.reg

        await usr.$query().patch({
          passkeys: JSON.stringify(usr.passkeys, (k, v) => {
            if (v instanceof Uint8Array) {
              return Array.apply([], v)
            }
            return v
          })
        })

        return {
          operation: generateSuccess('Passkey registered successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Deactivate a passkey
     */
    async deactivatePasskey (obj, args, context) {
      try {
        const userId = context.req.user?.id
        if (!userId) {
          throw new Error('ERR_USER_NOT_AUTHENTICATED')
        }

        const usr = await WIKI.db.users.query().findById(userId)
        if (!usr) {
          throw new Error('ERR_INVALID_USER')
        } else if (!usr.passkeys?.authenticators) {
          throw new Error('ERR_PASSKEY_NOT_SETUP')
        }

        usr.passkeys.authenticators = usr.passkeys.authenticators.filter(a => a.id !== args.id)

        await usr.$query().patch({
          passkeys: usr.passkeys
        })

        return {
          operation: generateSuccess('Passkey deactivated successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Login via passkey - Generate challenge
     */
    async authenticatePasskeyGenerate (obj, args, context) {
      try {
        const site = WIKI.sites[args.siteId]
        if (!site) {
          throw new Error('ERR_INVALID_SITE')
        } else if (site.hostname === '*') {
          WIKI.logger.warn('Cannot use passkeys with a wildcard site hostname. Enter a valid hostname under the Administration Area > General.')
          throw new Error('ERR_PK_HOSTNAME_MISSING')
        }

        const usr = await WIKI.db.users.query().findOne({ email: args.email })
        if (!usr || !usr.passkeys?.authenticators) {
          // Fake success response to prevent email leaking
          WIKI.logger.debug(`Cannot generate passkey challenge for ${args.email}... (non-existing or missing passkeys setup)`)
          return {
            operation: generateSuccess('Passkey challenge generated.'),
            authOptions: await generateAuthenticationOptions({
              allowCredentials: [{
                id: new Uint8Array(Array(30).map(v => _.random(0, 254))),
                type: 'public-key',
                transports: ['internal']
              }],
              userVerification: 'preferred',
              rpId: site.hostname
            })
          }
        }

        const options = await generateAuthenticationOptions({
          allowCredentials: usr.passkeys.authenticators.map(authenticator => ({
            id: new Uint8Array(authenticator.credentialID),
            type: 'public-key',
            transports: authenticator.transports
          })),
          userVerification: 'preferred',
          rpId: site.hostname
        })

        usr.passkeys.login = {
          challenge: options.challenge,
          rpId: site.hostname,
          siteId: site.id
        }

        await usr.$query().patch({
          passkeys: usr.passkeys
        })

        return {
          operation: generateSuccess('Passkey challenge generated.'),
          authOptions: options
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Login via passkey - Verify challenge
     */
    async authenticatePasskeyVerify (obj, args, context) {
      try {
        if (!args.authResponse?.response?.userHandle) {
          throw new Error('ERR_INVALID_PASSKEY_RESPONSE')
        }
        const usr = await WIKI.db.users.query().findById(args.authResponse.response.userHandle)
        if (!usr) {
          WIKI.logger.debug(`Passkey Login Failure: Cannot find user ${args.authResponse.response.userHandle}`)
          throw new Error('ERR_LOGIN_FAILED')
        } else if (!usr.passkeys?.login) {
          WIKI.logger.debug(`Passkey Login Failure: Missing login auth generation step for user ${args.authResponse.response.userHandle}`)
          throw new Error('ERR_LOGIN_FAILED')
        } else if (!usr.passkeys.authenticators?.some(a => a.id === args.authResponse.id)) {
          WIKI.logger.debug(`Passkey Login Failure: Authenticator provided is not registered for user ${args.authResponse.response.userHandle}`)
          throw new Error('ERR_LOGIN_FAILED')
        }

        const verification = await verifyAuthenticationResponse({
          response: args.authResponse,
          expectedChallenge: usr.passkeys.login.challenge,
          expectedOrigin: `https://${usr.passkeys.login.rpId}`,
          expectedRPID: usr.passkeys.login.rpId,
          requireUserVerification: true,
          authenticator: _.find(usr.passkeys.authenticators, ['id', args.authResponse.id])
        })

        if (!verification.verified) {
          WIKI.logger.debug(`Passkey Login Failure: Challenge verification failed for user ${args.authResponse.response.userHandle}`)
          throw new Error('ERR_LOGIN_FAILED')
        }

        delete usr.passkeys.login

        await usr.$query().patch({
          passkeys: usr.passkeys
        })

        const jwtToken = await WIKI.db.users.refreshToken(usr)

        return {
          operation: generateSuccess('Passkey challenge accepted.'),
          nextAction: 'redirect',
          jwt: jwtToken.token,
          redirect: '/'
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Perform Password Change
     */
    async changePassword (obj, args, context) {
      try {
        if (args.continuationToken) {
          const authResult = await WIKI.db.users.loginChangePassword(args, context)
          return {
            ...authResult,
            operation: generateSuccess('Password set successfully')
          }
        } else {
          await WIKI.db.users.changePassword(args, context)
          return {
            operation: generateSuccess('Password changed successfully')
          }
        }
      } catch (err) {
        WIKI.logger.debug(err)
        return generateError(err)
      }
    },
    /**
     * Perform Forget Password
     */
    async forgotPassword (obj, args, context) {
      try {
        await WIKI.db.users.loginForgotPassword(args, context)
        return {
          operation: generateSuccess('Password reset request processed.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Register a new account
     */
    async register (obj, args, context) {
      try {
        const usr = await WIKI.db.users.createNewUser({ ...args, userInitiated: true })
        const authResult = await WIKI.db.users.afterLoginChecks(usr, WIKI.data.systemIds.localAuthId, context)
        return {
          ...authResult,
          operation: generateSuccess('Registration success')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Refresh Token
     */
    async refreshToken (obj, args, context) {
      try {
        let decoded = {}
        if (!args.token) {
          throw new Error('ERR_MISSING_TOKEN')
        }
        try {
          decoded = jwt.verify(args.token, WIKI.config.auth.certs.public, {
            audience: WIKI.config.auth.audience,
            issuer: 'urn:wiki.js',
            algorithms: ['RS256'],
            ignoreExpiration: true
          })
        } catch (err) {
          throw new Error('ERR_INVALID_TOKEN')
        }
        if (DateTime.utc().minus(ms(WIKI.config.auth.tokenRenewal)) > DateTime.fromSeconds(decoded.exp)) {
          throw new Error('ERR_EXPIRED_TOKEN')
        }
        const newToken = await WIKI.db.users.refreshToken(decoded.id)
        return {
          jwt: newToken.token,
          operation: generateSuccess('Token refreshed successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Set API state
     */
    async setApiState (obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        WIKI.config.api.isEnabled = args.enabled
        await WIKI.configSvc.saveToDb(['api'])
        return {
          operation: generateSuccess('API State changed successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Revoke an API key
     */
    async revokeApiKey (obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        await WIKI.db.apiKeys.query().findById(args.id).patch({
          isRevoked: true
        })
        await WIKI.auth.reloadApiKeys()
        WIKI.events.outbound.emit('reloadApiKeys')
        return {
          operation: generateSuccess('API Key revoked successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Update Authentication Strategies
     */
    async updateAuthStrategies (obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        const previousStrategies = await WIKI.db.authentication.getStrategies()
        for (const str of args.strategies) {
          const newStr = {
            displayName: str.displayName,
            isEnabled: str.isEnabled,
            config: _.reduce(str.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {}),
            selfRegistration: str.selfRegistration,
            domainWhitelist: { v: str.domainWhitelist },
            autoEnrollGroups: { v: str.autoEnrollGroups }
          }

          if (_.some(previousStrategies, ['key', str.key])) {
            await WIKI.db.authentication.query().patch({
              key: str.key,
              strategyKey: str.strategyKey,
              ...newStr
            }).where('key', str.key)
          } else {
            await WIKI.db.authentication.query().insert({
              key: str.key,
              strategyKey: str.strategyKey,
              ...newStr
            })
          }
        }

        for (const str of _.differenceBy(previousStrategies, args.strategies, 'key')) {
          const hasUsers = await WIKI.db.users.query().count('* as total').where({ providerKey: str.key }).first()
          if (_.toSafeInteger(hasUsers.total) > 0) {
            throw new Error(`Cannot delete ${str.displayName} as 1 or more users are still using it.`)
          } else {
            await WIKI.db.authentication.query().delete().where('key', str.key)
          }
        }

        await WIKI.auth.activateStrategies()
        WIKI.events.outbound.emit('reloadAuthStrategies')
        return {
          responseResult: generateSuccess('Strategies updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Generate New Authentication Public / Private Key Certificates
     */
    async regenerateCertificates (obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        await WIKI.auth.regenerateCertificates()
        return {
          responseResult: generateSuccess('Certificates have been regenerated successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Reset Guest User
     */
    async resetGuestUser (obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        await WIKI.auth.resetGuestUser()
        return {
          responseResult: generateSuccess('Guest user has been reset successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  },
  // ------------------------------------------------------------------
  // TYPE: AuthenticationActiveStrategy
  // ------------------------------------------------------------------
  AuthenticationActiveStrategy: {
    config (obj, args, context) {
      if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }
      return obj.config ?? {}
    },
    allowedEmailRegex (obj, args, context) {
      if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }
      return obj.allowedEmailRegex ?? ''
    },
    autoEnrollGroups (obj, args, context) {
      if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }
      return obj.autoEnrollGroups ?? []
    },
    strategy (obj, args, context) {
      return _.find(WIKI.data.authentication, ['key', obj.module])
    }
  }
}
