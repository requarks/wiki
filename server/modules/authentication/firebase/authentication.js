/* global WIKI */

// ------------------------------------
// Firebase Account
// ------------------------------------

// INCOMPLETE / TODO

const FirebaseStrategy = require('passport-github2').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new FirebaseStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        scope: ['user:email']
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
