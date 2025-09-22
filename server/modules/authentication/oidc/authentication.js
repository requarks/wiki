const _ = require('lodash')
const { verifyJwt } = require('../../../helpers/jwt')
/* global WIKI */

// ------------------------------------
// OpenID Connect Account
// ------------------------------------

const OpenIDConnectStrategy = require('passport-openidconnect').Strategy

module.exports = {
  async init(passport, conf) {
    try {
      let oidcConfig = {
        issuer: conf.issuer,
        authorizationURL: conf.authorizationURL,
        tokenURL: conf.tokenURL,
        userInfoURL: conf.userInfoURL,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        scope: conf.scope,
        passReqToCallback: true,
        skipUserProfile: conf.skipUserProfile,
        acrValues: conf.acrValues
      }
      if (conf.wellKnownURL) {
        try {
          const response = await fetch(conf.wellKnownURL)
          if (!response.ok) throw new Error(response.statusText)
          const wellKnown = await response.json()
          if (!oidcConfig.issuer) oidcConfig.issuer = wellKnown.issuer
          if (!oidcConfig.authorizationURL) oidcConfig.authorizationURL = wellKnown.authorization_endpoint
          if (!oidcConfig.tokenURL) oidcConfig.tokenURL = wellKnown.token_endpoint
          if (!oidcConfig.userInfoURL) oidcConfig.userInfoURL = wellKnown.userinfo_endpoint
          oidcConfig.jwksUri = wellKnown.jwks_uri
          oidcConfig.idTokenSigningAlgValuesSupported = wellKnown.id_token_signing_alg_values_supported
        } catch (error) {
          WIKI.logger.error('Error fetching OIDC well-known configuration:', error)
        }
      }
      passport.use(conf.key, new OpenIDConnectStrategy(oidcConfig, async (req, iss, uiProfile, idProfile, context, idToken, accessToken, refreshToken, params, cb) => {
        let idTokenClaims = {}
        if (conf.mergeIdTokenClaims && idToken) {
          idTokenClaims = await verifyJwt(idToken, {
            issuer: oidcConfig.issuer,
            clientId: oidcConfig.clientID,
            jwksUri: oidcConfig.jwksUri,
            algorithms: oidcConfig.idTokenSigningAlgValuesSupported
          })
        }
        // Merge claims from ID token and profile, with idProfile taking precedence
        const profile = { ...idTokenClaims, ...idProfile }
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              id: _.get(profile, conf.userIdClaim),
              displayName: _.get(profile, conf.displayNameClaim, 'Unknown User'),
              email: _.get(profile, conf.emailClaim)
            }
          })
          if (conf.mapGroups) {
            const groups = _.get(profile, conf.groupsClaim)
            if (groups && _.isArray(groups)) {
              const currentGroups = (await user.$relatedQuery('groups').select('groups.id')).map(g => g.id)
              const expectedGroups = Object.values(WIKI.auth.groups).filter(g => groups.includes(g.name)).map(g => g.id)
              for (const groupId of _.difference(expectedGroups, currentGroups)) {
                await user.$relatedQuery('groups').relate(groupId)
              }
              for (const groupId of _.difference(currentGroups, expectedGroups)) {
                await user.$relatedQuery('groups').unrelate().where('groupId', groupId)
              }
            }
          }
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }))
    } catch (err) {
      WIKI.logger.error(`Error initializing OpenID Connect strategy: ${err}`)
    }
  },
  logout(conf) {
    return conf.logoutURL || '/'
  }
}
