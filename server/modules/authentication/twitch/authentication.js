/* global WIKI */

// ------------------------------------
// Twitch Account
// ------------------------------------

const TwitchStrategy = require('passport-twitch').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('twitch',
      new TwitchStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        scope: 'user_read'
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
