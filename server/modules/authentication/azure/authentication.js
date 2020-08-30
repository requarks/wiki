const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// Azure AD Account
// ------------------------------------

const OIDCStrategy = require('passport-azure-ad').OIDCStrategy

module.exports = {
  init (passport, conf) {
    passport.use('azure',
      new OIDCStrategy({
        identityMetadata: conf.entryPoint,
        clientID: conf.clientId,
        redirectUrl: conf.callbackURL,
        responseType: 'id_token',
        responseMode: 'form_post',
        scope: ['profile', 'email', 'openid'],
        allowHttpForRedirectUrl: WIKI.IS_DEBUG,
        passReqToCallback: true
      }, async (req, iss, sub, profile, cb) => {
        const usrEmail = _.get(profile, '_json.email', null) || _.get(profile, '_json.preferred_username')
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              id: profile.oid,
              displayName: profile.displayName,
              email: usrEmail,
              picture: ''
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}
