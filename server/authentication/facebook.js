'use strict'

/* global wiki */

// ------------------------------------
// Facebook Account
// ------------------------------------

const FacebookStrategy = require('passport-facebook').Strategy

module.exports = (passport) => {
  if (wiki.config.auth.facebook && wiki.config.auth.facebook.enabled) {
    passport.use('facebook',
      new FacebookStrategy({
        clientID: wiki.config.auth.facebook.clientId,
        clientSecret: wiki.config.auth.facebook.clientSecret,
        callbackURL: wiki.config.host + '/login/facebook/callback',
        profileFields: ['id', 'displayName', 'email']
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
