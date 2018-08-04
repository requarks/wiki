const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// OpenID Connect Account
// ------------------------------------

const OpenIDConnectStrategy = require('passport-openidconnect').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('oidc',
      new OpenIDConnectStrategy({
        authorizationURL: conf.authorizationURL,
        tokenURL: conf.tokenURL,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        issuer: conf.issuer,
        callbackURL: conf.callbackURL
      }, (iss, sub, profile, jwtClaims, accessToken, refreshToken, params, cb) => {
        WIKI.models.users.processProfile({
          id: jwtClaims.sub,
          provider: 'oidc',
          email: _.get(jwtClaims, conf.emailClaim),
          name: _.get(jwtClaims, conf.usernameClaim)
        }).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      })
    )
  }
}
