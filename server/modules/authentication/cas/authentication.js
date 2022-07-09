const _ = require('lodash')
/* global WIKI */

// ------------------------------------
// CAS Account
// ------------------------------------

const CASStrategy = require('passport-cas').Strategy

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new CASStrategy({
        version: conf.casVersion,
        ssoBaseURL: conf.casUrl,
        serverBaseURL: conf.baseUrl,
        serviceURL: conf.callbackURL,
        passReqToCallback: true
      }, async (req, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              id: _.get(profile.attributes, conf.uniqueIdAttribute, profile.user),
              email: _.get(profile.attributes, conf.emailAttribute),
              name: _.get(profile.attributes, conf.displayNameAttribute, profile.user),
              picture: ''
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
