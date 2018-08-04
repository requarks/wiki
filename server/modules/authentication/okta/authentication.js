/* global WIKI */

// ------------------------------------
// Okta Account
// ------------------------------------

const OktaStrategy = require('passport-okta-oauth').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('okta',
      new OktaStrategy({
        audience: conf.audience,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        idp: conf.idp,
        callbackURL: conf.callbackURL,
        response_type: 'code',
        scope: ['openid', 'email', 'profile']
      }, (accessToken, refreshToken, profile, cb) => {
        WIKI.models.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      })
    )
  }
}
