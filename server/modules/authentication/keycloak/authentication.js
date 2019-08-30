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
        callbackURL: conf.callbackURL
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              id: profile.keycloakId,
              email: profile.email,
              name: profile.username,
              picture: ''
            },
            providerKey: 'keycloak'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}
