/* global WIKI */

// ------------------------------------
// OAuth2 Account
// ------------------------------------

const OAuth2Strategy = require('passport-oauth2').Strategy

module.exports = {
  key: 'oauth2',
  title: 'OAuth2',
  useForm: false,
  props: {
    clientId: String,
    clientSecret: String,
    authorizationURL: String,
    tokenURL: String
  },
  init (passport, conf) {
    passport.use('oauth2',
      new OAuth2Strategy({
        authorizationURL: conf.authorizationURL,
        tokenURL: conf.tokenURL,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, (accessToken, refreshToken, profile, cb) => {
        WIKI.db.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      })
    )
  }
}
