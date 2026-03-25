const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// ORCID Account
// ------------------------------------

const OAuth2Strategy = require('passport-oauth2').Strategy

module.exports = {
  init (passport, conf) {
    var client = new OAuth2Strategy({
      authorizationURL: 'https://orcid.org/oauth/authorize',
      tokenURL: 'https://orcid.org/oauth/token',
      clientID: conf.clientId,
      clientSecret: conf.clientSecret,
      callbackURL: conf.callbackURL,
      passReqToCallback: true,
      scope: '/authenticate',
    }, async (req, accessToken, refreshToken, params, profile, cb) => {
      try {
        const user = await WIKI.models.users.processProfile({
          providerKey: req.params.strategy,
          profile: {
            ...profile,
            id: params.orcid,
            displayName: params.name,
            email: params.orcid + "@tehub.org",
          }
        })
        cb(null, user)
      } catch (err) {
        cb(err, null)
      }
    })

    client.userProfile = function (accesstoken, done) {
      this._oauth2._useAuthorizationHeaderForGET = !conf.useQueryStringForAccessToken
      this._oauth2.get('https://orcid.org/oauth/userinfo', accesstoken, (err, data) => {
        if (err) {
          return done(err)
        }
        try {
          data = JSON.parse(data)
        } catch (e) {
          return done(e)
        }
        done(null, data)
      })
    }
    passport.use(conf.key, client)
  },
  logout (conf) {
    if (!conf.logoutURL) {
      return '/'
    } else {
      return conf.logoutURL
    }
  }
}