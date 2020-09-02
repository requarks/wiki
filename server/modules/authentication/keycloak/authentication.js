const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// Keycloak Account
// ------------------------------------

const KeycloakStrategy = require('@exlinc/keycloak-passport')

module.exports = {
  init (passport, conf) {
    passport.use('keycloak',
      new KeycloakStrategy({
        authorizationURL: conf.authorizationURL,
        userInfoURL: conf.userInfoURL,
        tokenURL: conf.tokenURL,
        host: conf.host,
        realm: conf.realm,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        let displayName = profile.username
        if (_.isString(profile.fullName) && profile.fullName.length > 0) {
          displayName = profile.fullName
        }
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              id: profile.keycloakId,
              email: profile.email,
              name: displayName,
              picture: ''
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  },
  logout (conf) {
    if (!conf.logoutUpstream) {
      return '/'
    } else if (conf.logoutURL && conf.logoutURL.length > 5) {
      return `${conf.logoutURL}?redirect_uri=${encodeURIComponent(WIKI.config.host)}`
    } else {
      WIKI.logger.warn('Keycloak logout URL is not configured!')
      return '/'
    }
  }
}
