/* global WIKI */

// ------------------------------------
// Dropbox Account
// ------------------------------------

const DropboxStrategy = require('passport-dropbox-oauth2').Strategy

module.exports = {
  key: 'dropbox',
  title: 'Dropbox',
  useForm: false,
  props: {
    clientId: String,
    clientSecret: String
  },
  init (passport, conf) {
    passport.use('dropbox',
      new DropboxStrategy({
        apiVersion: '2',
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, (accessToken, refreshToken, profile, cb) => {
        WIKI.db.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      })
    )
  }
}
