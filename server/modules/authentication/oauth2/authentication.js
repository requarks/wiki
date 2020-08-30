/* global WIKI */

// ------------------------------------
// OAuth2 Account
// ------------------------------------

const OAuth2Strategy = require('passport-oauth2').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('oauth2',
      new OAuth2Strategy({
        authorizationURL: conf.authorizationURL,
        tokenURL: conf.tokenURL,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}
