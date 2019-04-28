/* global WIKI */

// ------------------------------------
// Google ID Account
// ------------------------------------

const GoogleStrategy = require('passport-google-oauth20').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('google',
      new GoogleStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              picture: _.get(profile, 'photos[0].value', '')
            },
            providerKey: 'google'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}
