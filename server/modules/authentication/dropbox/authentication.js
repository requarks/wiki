/* global WIKI */

// ------------------------------------
// Dropbox Account
// ------------------------------------

const DropboxStrategy = require('passport-dropbox-oauth2').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('dropbox',
      new DropboxStrategy({
        apiVersion: '2',
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, (accessToken, refreshToken, profile, cb) => {
        WIKI.models.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      })
    )
  }
}
