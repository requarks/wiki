const jwt = require('jsonwebtoken')
const moment = require('moment')

const securityHelper = require('../helpers/security')

/* global WIKI */

/**
 * Authentication middleware
 */
module.exports = {
  jwt(req, res, next) {
    WIKI.auth.passport.authenticate('jwt', {session: false}, async (err, user, info) => {
      if (err) { return next() }

      // Expired but still valid within 7 days, just renew
      if (info instanceof jwt.TokenExpiredError && moment().subtract(7, 'days').isBefore(info.expiredAt)) {
        const jwtPayload = jwt.decode(securityHelper.extractJWT(req))
        try {
          const newToken = await WIKI.models.users.refreshToken(jwtPayload.id)
          user = newToken.user

          // Try headers, otherwise cookies for response
          if (req.get('content-type') === 'application/json') {
            res.headers('new-jwt', newToken.token)
          } else {
            res.cookie('jwt', newToken.token, { expires: moment().add(7, 'days').toDate() })
          }
        } catch (err) {
          return next()
        }
      }

      // JWT is NOT valid
      if (!user) { return next() }

      // JWT is valid
      req.logIn(user, { session: false }, (err) => {
        if (err) { return next(err) }
        next()
      })
    })(req, res, next)
  },
  checkPath(req, res, next) {
    // Is user authenticated ?

    if (!req.isAuthenticated()) {
      if (WIKI.config.public !== true) {
        return res.redirect('/login')
      } else {
        // req.user = rights.guest
        res.locals.isGuest = true
      }
    } else {
      res.locals.isGuest = false
    }

    // Check permissions

    // res.locals.rights = rights.check(req)

    // if (!res.locals.rights.read) {
    //   return res.render('error-forbidden')
    // }

    // Expose user data

    res.locals.user = req.user

    return next()
  }
}
