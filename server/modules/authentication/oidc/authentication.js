const _ = require('lodash')

// ------------------------------------
// OpenID Connect Account
// ------------------------------------

const OpenIDConnectStrategy = require('passport-openidconnect').Strategy

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new OpenIDConnectStrategy({
        authorizationURL: conf.authorizationURL,
        tokenURL: conf.tokenURL,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        issuer: conf.issuer,
        userInfoURL: conf.userInfoURL,
        callbackURL: conf.callbackURL,
        passReqToCallback: true,
        skipUserProfile: false,
        store: new (class {
          store(req, ctx, appState, meta, cb) { cb(null, ctx.state || 'state') }
          verify(req, providedState, cb) { cb(null, true) }
        })()
      }, async (req, iss, sub, profile, cb) => {
        try {
          // Extract email from multiple possible locations
          const email = _.get(profile, '_json.' + conf.emailClaim) ||
            _.get(profile, '_json.email') ||
            _.get(profile, 'emails[0].value') ||
            _.get(profile, 'email') ||
            _.get(profile, conf.emailClaim)

          const displayName = _.get(profile, '_json.' + (conf.displayNameClaim || 'name')) ||
            _.get(profile, 'displayName') ||
            _.get(profile, '_json.name') ||
            _.get(profile, 'name.givenName', '') + ' ' + _.get(profile, 'name.familyName', '')

          WIKI.logger.info('OIDC profile: ' + JSON.stringify({ id: profile.id, email, displayName, keys: Object.keys(profile) }))

          const user = await WIKI.db.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              email: email,
              displayName: displayName.trim()
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
    if (!conf.logoutURL) {
      return '/'
    } else {
      return conf.logoutURL
    }
  }
}
