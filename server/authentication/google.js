'use strict'

/* global wiki */

// ------------------------------------
// Google ID Account
// ------------------------------------

const GoogleStrategy = require('passport-google-oauth20').Strategy

module.exports = (passport) => {
  if (wiki.config.auth.google && wiki.config.auth.google.enabled) {
    passport.use('google',
      new GoogleStrategy({
        clientID: wiki.config.auth.google.clientId,
        clientSecret: wiki.config.auth.google.clientSecret,
        callbackURL: wiki.config.host + '/login/google/callback'
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
