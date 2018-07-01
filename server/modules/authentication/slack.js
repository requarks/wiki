/* global WIKI */

// ------------------------------------
// Slack Account
// ------------------------------------

const SlackStrategy = require('passport-slack').Strategy

module.exports = {
  key: 'slack',
  title: 'Slack',
  useForm: false,
  props: {
    clientId: String,
    clientSecret: String
  },
  init (passport, conf) {
    passport.use('slack',
      new SlackStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, (accessToken, refreshToken, profile, cb) => {
        WIKI.db.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
