'use strict'

/* global wiki */

// ------------------------------------
// Slack Account
// ------------------------------------

const SlackStrategy = require('passport-slack').Strategy

module.exports = (passport) => {
  if (wiki.config.auth.slack && wiki.config.auth.slack.enabled) {
    passport.use('slack',
      new SlackStrategy({
        clientID: wiki.config.auth.slack.clientId,
        clientSecret: wiki.config.auth.slack.clientSecret,
        callbackURL: wiki.config.host + '/login/slack/callback'
      }, (accessToken, refreshToken, profile, cb) => {
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
