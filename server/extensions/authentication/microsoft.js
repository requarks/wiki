/* global wiki */

// ------------------------------------
// Microsoft Account
// ------------------------------------

const WindowsLiveStrategy = require('passport-windowslive').Strategy

module.exports = {
  key: 'microsoft',
  title: 'Microsoft Account',
  useForm: false,
  props: ['clientId', 'clientSecret', 'callbackURL'],
  init (passport, conf) {
    passport.use('microsoft',
      new WindowsLiveStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, function (accessToken, refreshToken, profile, cb) {
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
