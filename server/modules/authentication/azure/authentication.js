/* global WIKI */

// ------------------------------------
// Azure AD Account
// ------------------------------------

const AzureAdOAuth2Strategy = require('passport-azure-ad-oauth2').Strategy

module.exports = {
  init (passport, conf) {
    const jwt = require('jsonwebtoken')
    passport.use('azure_ad_oauth2',
      new AzureAdOAuth2Strategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        resource: conf.resource,
        tenant: conf.tenant
      }, (accessToken, refreshToken, params, profile, cb) => {
        console.info(params, profile)
        let waadProfile = jwt.decode(params.id_token)
        waadProfile.id = waadProfile.oid
        waadProfile.provider = 'azure'
        // WIKI.models.users.processProfile(waadProfile).then((user) => {
        //   return cb(null, user) || true
        // }).catch((err) => {
        //   return cb(err, null) || true
        // })
      }
      ))
  }
}
