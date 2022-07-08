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
        passReqToCallback: true
      }, async (req, profile, done) => {
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

          done(null, user)
        } catch (err) {
          done(err, null)
        }
      })
    )
  }
}
