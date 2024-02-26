/* global WIKI */

// ------------------------------------
// Google ID Account
// ------------------------------------

const GoogleStrategy = require('passport-google-oauth20').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    const strategy = new GoogleStrategy({
      clientID: conf.clientId,
      clientSecret: conf.clientSecret,
      callbackURL: conf.callbackURL,
      passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, cb) => {
      try {
        if (conf.hostedDomain && conf.hostedDomain != profile._json.hd) {
          throw new Error('Google authentication should have been performed with domain ' + conf.hostedDomain)
        }
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
    })

    if (conf.hostedDomain) {
      strategy.authorizationParams = function(options) {
        return {
          hd: conf.hostedDomain
        }
      }
    }

    passport.use(conf.key, strategy)
  },
  logout (conf) {
    return '/'
  }
}
