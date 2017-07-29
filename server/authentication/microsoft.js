'use strict'

/* global wiki */

// ------------------------------------
// Microsoft Account
// ------------------------------------

const WindowsLiveStrategy = require('passport-windowslive').Strategy

module.exports = (passport) => {
  if (wiki.config.auth.microsoft && wiki.config.auth.microsoft.enabled) {
    passport.use('windowslive',
      new WindowsLiveStrategy({
        clientID: wiki.config.auth.microsoft.clientId,
        clientSecret: wiki.config.auth.microsoft.clientSecret,
        callbackURL: wiki.config.host + '/login/ms/callback'
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
