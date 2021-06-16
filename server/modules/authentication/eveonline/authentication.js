const _ = require('lodash')
/* global WIKI */

// ------------------------------------
// EveOnline Account
// ------------------------------------

const OAuth2Strategy = require('passport-oauth2').Strategy
var jwt = require('jsonwebtoken');


module.exports = {
  init (passport, conf) {
    OAuth2Strategy.prototype.userProfile = function (accessToken, cb) {
      try {
        const payload = jwt.decode(accessToken);
        var sub=payload.sub;
        var chardetail=sub.split(":");
        var charid=chardetail[2];
        cb(null, {
          id: charid,
          displayName: payload.name,
          email: charid+'@auth.eveonline.com',
        })
      } catch (err) {
        WIKI.logger.warn('Eve Online - Failed to parse user profile.')
        cb(err)
      }
      }

    passport.use('eveonline',
      new OAuth2Strategy({
        authorizationURL: `https://login.eveonline.com/v2/oauth/authorize/`,
        tokenURL: `https://login.eveonline.com/v2/oauth/token`,
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
