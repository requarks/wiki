/* global WIKI */

// ------------------------------------
// CAS Account
// ------------------------------------

const CASStrategy = require('passport-cas').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('cas',
      new CASStrategy({
        ssoBaseURL: conf.ssoBaseURL,
        serverBaseURL: conf.serverBaseURL,
        passReqToCallback: true
      }, async (req, profile, cb) => {
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
  }
}
