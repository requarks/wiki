const _ = require('lodash')
const { verifyJwt } = require('../../../helpers/jwt')

/* global WIKI */

// ------------------------------------
// OpenID Connect Account
// ------------------------------------

const OpenIDConnectStrategy = require('passport-openidconnect').Strategy

module.exports = {
  async init (passport, conf) {
    try {
      const response = await fetch(conf.wellKnownURL)
      if (!response.ok) throw new Error(`Failed to fetch well-known config: ${response.statusText}`)
      const wellKnown = await response.json()

      passport.use(conf.key,
        new OpenIDConnectStrategy({
          issuer: wellKnown.issuer,
          authorizationURL: wellKnown.authorization_endpoint,
          tokenURL: wellKnown.token_endpoint,
          userInfoURL: wellKnown.userinfo_endpoint,
          clientID: conf.clientId,
          clientSecret: conf.clientSecret,
          callbackURL: conf.callbackURL,
          scope: conf.scope,
          passReqToCallback: true,
          skipUserProfile: conf.skipUserProfile,
          acrValues: conf.acrValues
        }, async (req, iss, uiProfile, idProfile, context, idToken, accessToken, refreshToken, params, cb) => {
          let idTokenClaims = {}
          if (conf.mergeIdTokenClaims && idToken) {
            idTokenClaims = await verifyJwt(idToken, {
              issuer: wellKnown.issuer,
              clientId: conf.clientId,
              jwksUri: wellKnown.jwks_uri,
              algorithms: wellKnown.id_token_signing_alg_values_supported
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
                displayName: _.get(profile, conf.displayNameClaim, '???'),
                email: _.get(profile, conf.emailClaim),
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
        })
      )
    } catch (error) {
      console.error('Error initializing OpenID Connect strategy:', error)
    }
  },
  logout (conf) {
    return conf.logoutURL || '/'
  }
}
