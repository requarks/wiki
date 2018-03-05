/* global WIKI */

// ------------------------------------
// Auth0 Account
// ------------------------------------

const Auth0Strategy = require('passport-auth0').Strategy

module.exports = {
  key: 'auth0',
  title: 'Auth0',
  useForm: false,
  props: ['domain', 'clientId', 'clientSecret'],
  init (passport, conf) {
    passport.use('auth0',
      new Auth0Strategy({
        domain: conf.domain,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, function (accessToken, refreshToken, profile, cb) {
        WIKI.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
