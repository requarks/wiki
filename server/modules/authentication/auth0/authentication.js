/* global WIKI */

// ------------------------------------
// Auth0 Account
// ------------------------------------

const Auth0Strategy = require('passport-auth0').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('auth0',
      new Auth0Strategy({
        domain: conf.domain,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, async (accessToken, refreshToken, extraParams, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({ profile, providerKey: 'auth0' })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
