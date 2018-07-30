/* global WIKI */

// ------------------------------------
// Slack Account
// ------------------------------------

const SlackStrategy = require('passport-slack').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('slack',
      new SlackStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, (accessToken, refreshToken, profile, cb) => {
        WIKI.models.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
