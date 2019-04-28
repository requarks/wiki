/* global WIKI */

// ------------------------------------
// Facebook Account
// ------------------------------------

const FacebookStrategy = require('passport-facebook').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('facebook',
      new FacebookStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        profileFields: ['id', 'displayName', 'email', 'photos'],
        authType: 'reauthenticate'
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              picture: _.get(profile, 'photos[0].value', '')
            },
            providerKey: 'facebook'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
