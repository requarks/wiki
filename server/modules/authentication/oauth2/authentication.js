const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// OAuth2 Account
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
      scope: conf.scope,
      state: conf.enableCSRFProtection
    }, async (req, accessToken, refreshToken, profile, cb) => {
      try {
        const user = await WIKI.models.users.processProfile({
          providerKey: req.params.strategy,
          profile: {
            ...profile,
            id: _.get(profile, conf.userIdClaim),
            displayName: _.get(profile, conf.displayNameClaim, '???'),
            email: _.get(profile, conf.emailClaim)
          }
        })
        if (conf.mapGroups) {
          const groups = _.get(profile, conf.groupsClaim)
          if (groups && _.isArray(groups)) {
            const currentGroups = (await user.$relatedQuery('groups').select('groups.id')).map(g => g.id)
            const expectedGroups = Object.values(WIKI.auth.groups).filter(g => groups.includes(g.name)).map(g => g.id)
            for (const groupId of _.difference(expectedGroups, currentGroups)) {
              await user.$relatedQuery('groups').relate(groupId)
            }
            for (const groupId of _.difference(currentGroups, expectedGroups)) {
              await user.$relatedQuery('groups').unrelate().where('groupId', groupId)
            }
          }
        }
        cb(null, user)
      } catch (err) {
        cb(err, null)
      }
    })

    client.userProfile = function (accesstoken, done) {
      this._oauth2._useAuthorizationHeaderForGET = !conf.useQueryStringForAccessToken
      this._oauth2.get(conf.userInfoURL, accesstoken, (err, data) => {
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
