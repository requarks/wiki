'use strict'

/* global wiki */

// ------------------------------------
// Azure AD Account
// ------------------------------------

const AzureAdOAuth2Strategy = require('passport-azure-ad-oauth2').Strategy

module.exports = (passport) => {
  if (wiki.config.auth.azure && wiki.config.auth.azure.enabled) {
    const jwt = require('jsonwebtoken')
    passport.use('azure_ad_oauth2',
      new AzureAdOAuth2Strategy({
        clientID: wiki.config.auth.azure.clientId,
        clientSecret: wiki.config.auth.azure.clientSecret,
        callbackURL: wiki.config.host + '/login/azure/callback',
        resource: wiki.config.auth.azure.resource,
        tenant: wiki.config.auth.azure.tenant
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
