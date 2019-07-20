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
        allowHttpForRedirectUrl: WIKI.IS_DEBUG
      }, (iss, sub, profile, cb) => {
        console.info(iss, sub, profile)
        // WIKI.models.users.processProfile(waadProfile).then((user) => {
        //   return cb(null, user) || true
        // }).catch((err) => {
        //   return cb(err, null) || true
        // })
      }
      ))
  }
}
