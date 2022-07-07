/* global WIKI */

// ------------------------------------
// CAS Account
// ------------------------------------

const CASStrategy = require('passport-cas').Strategy

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new CASStrategy({
        version: 'CAS3.0',
        ssoBaseURL: conf.casUrl,
        serverBaseURL: conf.baseUrl,
        passReqToCallback: true
      }, async (req, profile, cb) => {
        try {
          let userEmail = null
          let displayName = null

          if (conf.emailAttribute) {
            userEmail = profile.attributes[ conf.emailAttribute ]
          }

          if (conf.displayNameAttribute) {
            displayName = profile.attributes[ conf.displayNameAttribute ]
          } else {
            displayName = profile.user
          }

          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              id: profile.user,
              email: userEmail,
              name: displayName
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
