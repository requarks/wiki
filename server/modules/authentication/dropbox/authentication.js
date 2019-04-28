/* global WIKI */

// ------------------------------------
// Dropbox Account
// ------------------------------------

const DropboxStrategy = require('passport-dropbox-oauth2').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('dropbox',
      new DropboxStrategy({
        apiVersion: '2',
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              picture: _.get(profile, '_json.profile_photo_url', '')
            },
            providerKey: 'dropbox'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}
