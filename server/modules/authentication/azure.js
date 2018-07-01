/* global WIKI */

// ------------------------------------
// Azure AD Account
// ------------------------------------

const AzureAdOAuth2Strategy = require('passport-azure-ad-oauth2').Strategy

module.exports = {
  key: 'azure',
  title: 'Azure Active Directory',
  useForm: false,
  props: {
    clientId: String,
    clientSecret: String,
    resource: {
      type: String,
      default: '00000002-0000-0000-c000-000000000000'
    },
    tenant: {
      type: String,
      default: 'YOUR_TENANT.onmicrosoft.com'
    }
  },
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
        let waadProfile = jwt.decode(params.id_token)
        waadProfile.id = waadProfile.oid
        waadProfile.provider = 'azure'
        WIKI.db.users.processProfile(waadProfile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
