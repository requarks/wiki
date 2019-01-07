const passport = require('passport')
const passportJWT = require('passport-jwt')
const fs = require('fs-extra')
const _ = require('lodash')
const path = require('path')
const jwt = require('jsonwebtoken')
const moment = require('moment')

const securityHelper = require('../helpers/security')

/* global WIKI */

module.exports = {
  strategies: {},
  guest: {
    cacheExpiration: moment.utc().subtract(1, 'd')
  },

  /**
   * Initialize the authentication module
   */
  init() {
    this.passport = passport

    passport.serializeUser(function (user, done) {
      done(null, user.id)
    })

    passport.deserializeUser(function (id, done) {
      WIKI.models.users.query().findById(id).then((user) => {
        if (user) {
          done(null, user)
        } else {
          done(new Error(WIKI.lang.t('auth:errors:usernotfound')), null)
        }
        return true
      }).catch((err) => {
        done(err, null)
      })
    })

    return this
  },

  /**
   * Load authentication strategies
   */
  async activateStrategies() {
    try {
      // Unload any active strategies
      WIKI.auth.strategies = {}
      const currentStrategies = _.keys(passport._strategies)
      _.pull(currentStrategies, 'session')
      _.forEach(currentStrategies, stg => { passport.unuse(stg) })

      // Load JWT
      passport.use('jwt', new passportJWT.Strategy({
        jwtFromRequest: securityHelper.extractJWT,
        secretOrKey: WIKI.config.certs.public,
        audience: WIKI.config.auth.audience,
        issuer: 'urn:wiki.js'
      }, (jwtPayload, cb) => {
        cb(null, jwtPayload)
      }))

      // Load enabled strategies
      const enabledStrategies = await WIKI.models.authentication.getStrategies()
      for (let idx in enabledStrategies) {
        const stg = enabledStrategies[idx]
        if (!stg.isEnabled) { continue }

        const strategy = require(`../modules/authentication/${stg.key}/authentication.js`)

        stg.config.callbackURL = `${WIKI.config.host}/login/${stg.key}/callback`
        strategy.init(passport, stg.config)

        fs.readFile(path.join(WIKI.ROOTPATH, `assets/svg/auth-icon-${strategy.key}.svg`), 'utf8').then(iconData => {
          strategy.icon = iconData
        }).catch(err => {
          if (err.code === 'ENOENT') {
            strategy.icon = '[missing icon]'
          } else {
            WIKI.logger.warn(err)
          }
        })
        WIKI.auth.strategies[stg.key] = strategy
        WIKI.logger.info(`Authentication Strategy ${stg.key}: [ OK ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Authentication Strategy: [ FAILED ]`)
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
  authenticate(req, res, next) {
    WIKI.auth.passport.authenticate('jwt', {session: false}, async (err, user, info) => {
      if (err) { return next() }

      // Expired but still valid within N days, just renew
      if (info instanceof Error && info.name === 'TokenExpiredError' && moment().subtract(14, 'days').isBefore(info.expiredAt)) {
        const jwtPayload = jwt.decode(securityHelper.extractJWT(req))
        try {
          const newToken = await WIKI.models.users.refreshToken(jwtPayload.id)
          user = newToken.user

          // Try headers, otherwise cookies for response
          if (req.get('content-type') === 'application/json') {
            res.set('new-jwt', newToken.token)
          } else {
            res.cookie('jwt', newToken.token, { expires: moment().add(365, 'days').toDate() })
          }
        } catch (err) {
          return next()
        }
      }

      // JWT is NOT valid, set as guest
      if (!user) {
        if (WIKI.auth.guest.cacheExpiration ) {
          WIKI.auth.guest = await WIKI.models.users.getGuestUser()
          WIKI.auth.guest.cacheExpiration = moment.utc().add(1, 'm')
        }
        req.user = WIKI.auth.guest
        return next()
      }

      // JWT is valid
      req.logIn(user, { session: false }, (err) => {
        if (err) { return next(err) }
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
  checkAccess(user, permissions = [], path = false) {
    // System Admin
    if (_.includes(user.permissions, 'manage:system')) {
      return true
    }

    // Check Global Permissions
    if (_.intersection(user.permissions, permissions).length < 1) {
      return false
    }

    // Check Page Rules
    return false
  }
}
