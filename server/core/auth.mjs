import passport from 'passport'
import passportJWT from 'passport-jwt'
import _ from 'lodash'
import jwt from 'jsonwebtoken'
import ms from 'ms'
import { DateTime } from 'luxon'
import util from 'node:util'
import crypto from 'node:crypto'
import { pem2jwk } from 'pem-jwk'
import NodeCache from 'node-cache'
import { extractJWT } from '../helpers/security.mjs'

const randomBytes = util.promisify(crypto.randomBytes)

export default {
  strategies: {},
  guest: {
    cacheExpiration: DateTime.utc().minus({ days: 1 })
  },
  groups: {},
  validApiKeys: [],
  revocationList: new NodeCache(),

  /**
   * Initialize the authentication module
   */
  init() {
    this.passport = passport

    passport.serializeUser((user, done) => {
      done(null, user.id)
    })

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await WIKI.db.users.query().findById(id).withGraphFetched('groups').modifyGraph('groups', builder => {
          builder.select('groups.id', 'permissions')
        })
        if (user) {
          done(null, user)
        } else {
          done(new Error(WIKI.lang.t('auth:errors:usernotfound')), null)
        }
      } catch (err) {
        done(err, null)
      }
    })

    this.reloadGroups()
    this.reloadApiKeys()

    return this
  },

  /**
   * Load authentication strategies
   */
  async activateStrategies () {
    try {
      // Unload any active strategies
      WIKI.auth.strategies = {}
      const currentStrategies = _.keys(passport._strategies)
      _.pull(currentStrategies, 'session')
      _.forEach(currentStrategies, stg => { passport.unuse(stg) })

      // Load JWT
      passport.use('jwt', new passportJWT.Strategy({
        jwtFromRequest: extractJWT,
        secretOrKey: WIKI.config.auth.certs.public,
        audience: WIKI.config.auth.audience,
        issuer: 'urn:wiki.js',
        algorithms: ['RS256']
      }, (jwtPayload, cb) => {
        cb(null, jwtPayload)
      }))

      // Load enabled strategies
      const enabledStrategies = await WIKI.db.authentication.getStrategies({ enabledOnly: true })
      for (const stg of enabledStrategies) {
        try {
          const strategy = (await import(`../modules/authentication/${stg.module}/authentication.mjs`)).default

          stg.config.callbackURL = `${WIKI.config.host}/login/${stg.id}/callback`
          stg.config.key = stg.id
          strategy.init(passport, stg.config)
          strategy.config = stg.config

          WIKI.auth.strategies[stg.key] = {
            ...strategy,
            ...stg
          }
          WIKI.logger.info(`Authentication Strategy ${stg.displayName}: [ OK ]`)
        } catch (err) {
          WIKI.logger.error(`Authentication Strategy ${stg.displayName} (${stg.id}): [ FAILED ]`)
          WIKI.logger.error(err)
        }
      }
    } catch (err) {
      WIKI.logger.error(`Failed to initialize Authentication Strategies: [ ERROR ]`)
      WIKI.logger.error(err)
    }
  },

  /**
   * Authenticate current request
   *
   * @param {Express Request} req
   * @param {Express Response} res
   * @param {Express Next Callback} next
   */
  authenticate (req, res, next) {
    WIKI.auth.passport.authenticate('jwt', { session: false }, async (err, user, info) => {
      if (err) { return next() }
      let mustRevalidate = false
      const strategyId = user.pvd

      // Expired but still valid within N days, just renew
      if (info instanceof Error && info.name === 'TokenExpiredError') {
        const expiredDate = (info.expiredAt instanceof Date) ? info.expiredAt.toISOString() : info.expiredAt
        if (DateTime.utc().minus(ms(WIKI.config.auth.tokenRenewal)) < DateTime.fromISO(expiredDate)) {
          mustRevalidate = true
        }
      }

      // Check if user / group is in revocation list
      if (user && !user.api && !mustRevalidate) {
        const uRevalidate = WIKI.auth.revocationList.get(`u${_.toString(user.id)}`)
        if (uRevalidate && user.iat < uRevalidate) {
          mustRevalidate = true
        } else if (DateTime.fromSeconds(user.iat) <= WIKI.startedAt) { // Prevent new / restarted instance from allowing revoked tokens
          mustRevalidate = true
        } else {
          for (const gid of user.groups) {
            const gRevalidate = WIKI.auth.revocationList.get(`g${_.toString(gid)}`)
            if (gRevalidate && user.iat < gRevalidate) {
              mustRevalidate = true
              break
            }
          }
        }
      }

      // Revalidate and renew token
      if (mustRevalidate && !req.path.startsWith('/_graphql')) {
        const jwtPayload = jwt.decode(extractJWT(req))
        try {
          const newToken = await WIKI.db.users.refreshToken(jwtPayload.id, jwtPayload.pvd)
          user = newToken.user
          user.permissions = user.getPermissions()
          user.groups = user.getGroups()
          user.strategyId = strategyId
          req.user = user

          // Try headers, otherwise cookies for response
          if (req.get('content-type') === 'application/json') {
            res.set('new-jwt', newToken.token)
          } else {
            res.cookie('jwt', newToken.token, { expires: DateTime.utc().plus({ days: 365 }).toJSDate() })
          }
        } catch (errc) {
          WIKI.logger.warn(errc)
          return next()
        }
      } else if (user) {
        user = await WIKI.db.users.getById(user.id)
        user.permissions = user.getPermissions()
        user.groups = user.getGroups()
        user.strategyId = strategyId
        req.user = user
      } else {
        // JWT is NOT valid, set as guest
        if (WIKI.auth.guest.cacheExpiration <= DateTime.utc()) {
          WIKI.auth.guest = await WIKI.db.users.getGuestUser()
          WIKI.auth.guest.cacheExpiration = DateTime.utc().plus({ minutes: 1 })
        }
        req.user = WIKI.auth.guest
        return next()
      }

      // Process API tokens
      if (_.has(user, 'api')) {
        if (!WIKI.config.api.isEnabled) {
          return next(new Error('API is disabled. You must enable it from the Administration Area first.'))
        } else if (_.includes(WIKI.auth.validApiKeys, user.api)) {
          req.user = {
            id: 1,
            email: 'api@localhost',
            name: 'API',
            pictureUrl: null,
            timezone: 'America/New_York',
            locale: 'en',
            permissions: _.get(WIKI.auth.groups, `${user.grp}.permissions`, []),
            groups: [user.grp],
            getPermissions () {
              return req.user.permissions
            },
            getGroups () {
              return req.user.groups
            }
          }
          return next()
        } else {
          return next(new Error('API Key is invalid or was revoked.'))
        }
      }

      // JWT is valid
      req.logIn(user, { session: false }, (errc) => {
        if (errc) { return next(errc) }
        next()
      })
    })(req, res, next)
  },

  /**
   * Check if user has access to resource
   *
   * @param {User} user
   * @param {Array<String>} permissions
   * @param {String|Boolean} path
   */
  checkAccess(user, permissions = [], page = false) {
    const userPermissions = user.permissions ? user.permissions : user.getPermissions()

    // System Admin
    if (_.includes(userPermissions, 'manage:system')) {
      return true
    }

    // Check Global Permissions
    if (_.intersection(userPermissions, permissions).length < 1) {
      return false
    }

    // Skip if no page rule to check
    if (!page) {
      return true
    }

    // Check Page Rules
    if (user.groups) {
      let checkState = {
        deny: false,
        match: false,
        specificity: ''
      }
      user.groups.forEach(grp => {
        const grpId = _.isObject(grp) ? _.get(grp, 'id', 0) : grp
        _.get(WIKI.auth.groups, `${grpId}.pageRules`, []).forEach(rule => {
          if (rule.locales && rule.locales.length > 0) {
            if (!rule.locales.includes(page.locale)) { return }
          }
          if (_.intersection(rule.roles, permissions).length > 0) {
            switch (rule.match) {
              case 'START':
                if (_.startsWith(`/${page.path}`, `/${rule.path}`)) {
                  checkState = this._applyPageRuleSpecificity({ rule, checkState, higherPriority: ['END', 'REGEX', 'EXACT', 'TAG'] })
                }
                break
              case 'END':
                if (_.endsWith(page.path, rule.path)) {
                  checkState = this._applyPageRuleSpecificity({ rule, checkState, higherPriority: ['REGEX', 'EXACT', 'TAG'] })
                }
                break
              case 'REGEX':
                const reg = new RegExp(rule.path)
                if (reg.test(page.path)) {
                  checkState = this._applyPageRuleSpecificity({ rule, checkState, higherPriority: ['EXACT', 'TAG'] })
                }
                break
              case 'TAG':
                _.get(page, 'tags', []).forEach(tag => {
                  if (tag.tag === rule.path) {
                    checkState = this._applyPageRuleSpecificity({
                      rule,
                      checkState,
                      higherPriority: ['EXACT']
                    })
                  }
                })
                break
              case 'EXACT':
                if (`/${page.path}` === `/${rule.path}`) {
                  checkState = this._applyPageRuleSpecificity({ rule, checkState, higherPriority: [] })
                }
                break
            }
          }
        })
      })

      return (checkState.match && !checkState.deny)
    }

    return false
  },

  /**
   * Check for exclusive permissions (contain any X permission(s) but not any Y permission(s))
   *
   * @param {User} user
   * @param {Array<String>} includePermissions
   * @param {Array<String>} excludePermissions
   */
  checkExclusiveAccess(user, includePermissions = [], excludePermissions = []) {
    const userPermissions = user.permissions ? user.permissions : user.getPermissions()

    // Check Inclusion Permissions
    if (_.intersection(userPermissions, includePermissions).length < 1) {
      return false
    }

    // Check Exclusion Permissions
    if (_.intersection(userPermissions, excludePermissions).length > 0) {
      return false
    }

    return true
  },

  /**
   * Check and apply Page Rule specificity
   *
   * @access private
   */
  _applyPageRuleSpecificity ({ rule, checkState, higherPriority = [] }) {
    if (rule.path.length === checkState.specificity.length) {
      // Do not override higher priority rules
      if (_.includes(higherPriority, checkState.match)) {
        return checkState
      }
      // Do not override a previous DENY rule with same match
      if (rule.match === checkState.match && checkState.deny && !rule.deny) {
        return checkState
      }
    } else if (rule.path.length < checkState.specificity.length) {
      // Do not override higher specificity rules
      return checkState
    }

    return {
      deny: rule.deny,
      match: rule.match,
      specificity: rule.path
    }
  },

  /**
   * Reload Groups from DB
   */
  async reloadGroups () {
    const groupsArray = await WIKI.db.groups.query()
    this.groups = _.keyBy(groupsArray, 'id')
    WIKI.auth.guest.cacheExpiration = DateTime.utc().minus({ days: 1 })
  },

  /**
   * Reload valid API Keys from DB
   */
  async reloadApiKeys () {
    const keys = await WIKI.db.apiKeys.query().select('id').where('isRevoked', false).andWhere('expiration', '>', DateTime.utc().toISO())
    this.validApiKeys = _.map(keys, 'id')
  },

  /**
   * Generate New Authentication Public / Private Key Certificates
   */
  async regenerateCertificates () {
    WIKI.logger.info('Regenerating certificates...')

    _.set(WIKI.config, 'sessionSecret', (await randomBytes(32)).toString('hex'))
    const certs = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: WIKI.config.sessionSecret
      }
    })

    _.set(WIKI.config, 'certs', {
      jwk: pem2jwk(certs.publicKey),
      public: certs.publicKey,
      private: certs.privateKey
    })

    await WIKI.configSvc.saveToDb([
      'certs',
      'sessionSecret'
    ])

    await WIKI.auth.activateStrategies()
    WIKI.events.outbound.emit('reloadAuthStrategies')

    WIKI.logger.info('Regenerated certificates: [ COMPLETED ]')
  },

  /**
   * Reset Guest User
   */
  async resetGuestUser() {
    WIKI.logger.info('Resetting guest account...')
    const guestGroup = await WIKI.db.groups.query().where('id', 2).first()

    await WIKI.db.users.query().delete().where({
      providerKey: 'local',
      email: 'guest@example.com'
    }).orWhere('id', 2)

    const guestUser = await WIKI.db.users.query().insert({
      id: 2,
      provider: 'local',
      email: 'guest@example.com',
      name: 'Guest',
      password: '',
      locale: 'en',
      defaultEditor: 'markdown',
      tfaIsActive: false,
      isSystem: true,
      isActive: true,
      isVerified: true
    })
    await guestUser.$relatedQuery('groups').relate(guestGroup.id)

    WIKI.logger.info('Guest user has been reset: [ COMPLETED ]')
  },

  /**
   * Subscribe to HA propagation events
   */
  subscribeToEvents() {
    WIKI.events.inbound.on('reloadGroups', () => {
      WIKI.auth.reloadGroups()
    })
    WIKI.events.inbound.on('reloadApiKeys', () => {
      WIKI.auth.reloadApiKeys()
    })
    WIKI.events.inbound.on('reloadAuthStrategies', () => {
      WIKI.auth.activateStrategies()
    })
    WIKI.events.inbound.on('addAuthRevoke', (args) => {
      WIKI.auth.revokeUserTokens(args)
    })
  },

  /**
   * Get all user permissions for a specific page
   */
  getEffectivePermissions (req, page) {
    return {
      comments: {
        read: WIKI.auth.checkAccess(req.user, ['read:comments'], page),
        write: WIKI.auth.checkAccess(req.user, ['write:comments'], page),
        manage: WIKI.auth.checkAccess(req.user, ['manage:comments'], page)
      },
      history: {
        read: WIKI.auth.checkAccess(req.user, ['read:history'], page)
      },
      source: {
        read: WIKI.auth.checkAccess(req.user, ['read:source'], page)
      },
      pages: {
        read: WIKI.auth.checkAccess(req.user, ['read:pages'], page),
        write: WIKI.auth.checkAccess(req.user, ['write:pages'], page),
        manage: WIKI.auth.checkAccess(req.user, ['manage:pages'], page),
        delete: WIKI.auth.checkAccess(req.user, ['delete:pages'], page),
        script: WIKI.auth.checkAccess(req.user, ['write:scripts'], page),
        style: WIKI.auth.checkAccess(req.user, ['write:styles'], page)
      },
      system: {
        manage: WIKI.auth.checkAccess(req.user, ['manage:system'], page)
      }
    }
  },

  /**
   * Add user / group ID to JWT revocation list, forcing all requests to be validated against the latest permissions
   */
  revokeUserTokens ({ id, kind = 'u' }) {
    WIKI.auth.revocationList.set(`${kind}${_.toString(id)}`, Math.round(DateTime.utc().minus({ seconds: 5 }).toSeconds()), Math.ceil(ms(WIKI.config.auth.tokenExpiration) / 1000))
  }
}
