/* global WIKI */

// ------------------------------------
// Facebook Account
// ------------------------------------

const FacebookStrategy = require('passport-facebook').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('facebook',
      new FacebookStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        profileFields: ['id', 'displayName', 'email']
      }, function (accessToken, refreshToken, profile, cb) {
        WIKI.models.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
