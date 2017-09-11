'use strict'

/* global wiki */

// ------------------------------------
// Azure AD Account
// ------------------------------------

const AzureAdOAuth2Strategy = require('passport-azure-ad-oauth2').Strategy

module.exports = {
  key: 'azure',
  title: 'Azure Active Directory',
  props: ['clientId', 'clientSecret', 'callbackURL', 'resource', 'tenant'],
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
        wiki.db.User.processProfile(waadProfile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
