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
        WIKI.logger.info(`Google OAuth: Processing profile for user ${profile.id || profile.displayName}`)
        
        // Validate hosted domain if configured
        if (conf.hostedDomain && profile._json.hd !== conf.hostedDomain) {
          throw new Error(`Google authentication failed: User must be from domain ${conf.hostedDomain}, but got ${profile._json.hd || 'unknown'}`)
        }

        const user = await WIKI.models.users.processProfile({
          providerKey: req.params.strategy,
          profile: {
            ...profile,
            picture: _.get(profile, 'photos[0].value', '')
          }
        })
        
        WIKI.logger.info(`Google OAuth: Successfully authenticated user ${user.email}`)
        cb(null, user)
      } catch (err) {
        WIKI.logger.warn(`Google OAuth: Authentication failed for strategy ${req.params.strategy}:`, err)
        // Provide more user-friendly error messages
        if (err.message && err.message.includes('domain')) {
          cb(new Error(`Google authentication failed: ${err.message}`), null)
        } else if (err.message && err.message.includes('email')) {
          cb(new Error('Google authentication failed: Email address is required but not available. Please ensure your Google account has a verified email address.'), null)
        } else if (err instanceof WIKI.Error.AuthAccountBanned) {
          cb(err, null)
        } else {
          cb(new Error(`Google authentication failed: ${err.message || 'Unknown error'}`), null)
        }
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
