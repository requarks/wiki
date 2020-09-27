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
        authType: 'reauthenticate',
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              picture: _.get(profile, 'photos[0].value', '')
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
