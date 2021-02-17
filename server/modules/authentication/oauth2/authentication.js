const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// OAuth2 Connect Account
// ------------------------------------

const OAuth2Strategy = require('passport-oauth2').Strategy

module.exports = {
  init (passport, conf) {
    var client = new OAuth2Strategy({
      authorizationURL: conf.authorizationURL,
      tokenURL: conf.tokenURL,
      clientID: conf.clientId,
      clientSecret: conf.clientSecret,
      userInfoURL: conf.userInfoURL,
      callbackURL: conf.callbackURL,
      passReqToCallback: true,
    }, async (req, accessToken, refreshToken, profile, cb) => {
      try {
        const user = await WIKI.models.users.processProfile({
          providerKey: req.params.strategy,
          profile: {
            ...profile,
            id: _.get(profile, conf.userId),
            displayName: _.get(profile, conf.displayName, ''),
            email: _.get(profile, conf.emailClaim)
          }
        })
        cb(null, user)
      } catch (err) {
        cb(err, null)
      }
    })

    client.userProfile = function (accesstoken, done) {
      this._oauth2._useAuthorizationHeaderForGET = true;
      this._oauth2.get(conf.userInfoURL, accesstoken, (err, data) => {
        if (err) {
          return done(err)
        }
        try {
          data = JSON.parse(data)
        } catch(e) {
          return done(e)
        }
        done(null, data)
      })
    }
    passport.use('oauth2', client)
  }
}
