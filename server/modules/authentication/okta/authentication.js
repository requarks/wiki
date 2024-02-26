/* global WIKI */

// ------------------------------------
// Okta Account
// ------------------------------------

const OktaStrategy = require('passport-okta-oauth').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new OktaStrategy({
        audience: conf.audience,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        idp: conf.idp,
        callbackURL: conf.callbackURL,
        response_type: 'code',
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              picture: _.get(profile, '_json.profile', '')
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
