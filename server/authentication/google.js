'use strict'

/* global wiki */

// ------------------------------------
// Google ID Account
// ------------------------------------

const GoogleStrategy = require('passport-google-oauth20').Strategy

module.exports = {
  key: 'google',
  title: 'Google ID',
  props: ['clientId', 'clientSecret', 'callbackURL'],
  init (passport, conf) {
    passport.use('google',
      new GoogleStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
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
