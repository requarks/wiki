'use strict'

/* global wiki */

// ------------------------------------
// GitHub Account
// ------------------------------------

const GitHubStrategy = require('passport-github2').Strategy

module.exports = (passport) => {
  if (wiki.config.auth.github && wiki.config.auth.github.enabled) {
    passport.use('github',
      new GitHubStrategy({
        clientID: wiki.config.auth.github.clientId,
        clientSecret: wiki.config.auth.github.clientSecret,
        callbackURL: wiki.config.host + '/login/github/callback',
        scope: ['user:email']
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
