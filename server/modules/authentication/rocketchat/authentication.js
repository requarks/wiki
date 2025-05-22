const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// Rocket.chat Account
// ------------------------------------

const OAuth2Strategy = require('passport-oauth2').Strategy

module.exports = {
  init (passport, conf) {
    const siteURL = conf.siteURL.slice(-1) === '/' ? conf.siteURL.slice(0, -1) : conf.siteURL

    OAuth2Strategy.prototype.userProfile = function (accessToken, cb) {
      this._oauth2.useAuthorizationHeaderforGET(true)
      this._oauth2.get(`${siteURL}/oauth/userinfo`, accessToken, (err, body, res) => {
        if (err) {
          WIKI.logger.warn('Rocket.chat - Failed to fetch user profile.')
          return cb(err)
        }
        try {
          const usr = JSON.parse(body)
          cb(null, {
            id: usr.sub,
            displayName: _.isEmpty(usr.name) ? usr.preffered_username : usr.name,
            email: usr.email,
            picture: usr.picture
          })
        } catch (err) {
          WIKI.logger.warn('Rocket.chat - Failed to parse user profile.')
          cb(err)
        }
      })
    }

    passport.use(conf.key,
      new OAuth2Strategy({
        authorizationURL: `${siteURL}/oauth/authorize`,
        tokenURL: `${siteURL}/oauth/token`,
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        passReqToCallback: true,
        state: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile
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
