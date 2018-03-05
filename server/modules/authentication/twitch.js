/* global WIKI */

// ------------------------------------
// Twitch Account
// ------------------------------------

const TwitchStrategy = require('passport-twitch').Strategy

module.exports = {
  key: 'twitch',
  title: 'Twitch',
  useForm: false,
  props: ['clientId', 'clientSecret'],
  init (passport, conf) {
    passport.use('twitch',
      new TwitchStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        scope: 'user_read'
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
