/* global WIKI */

// ------------------------------------
// Local Account
// ------------------------------------

const LocalStrategy = require('passport-local').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('local',
      new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
      }, async (uEmail, uPassword, done) => {
        try {
          const user = await WIKI.models.users.query().findOne({
            email: uEmail,
            providerKey: 'local'
          })
          if (user) {
            await user.verifyPassword(uPassword)
            if (!user.isActive) {
              done(new WIKI.Error.AuthAccountBanned(), null)
            } else if (!user.isVerified) {
              done(new WIKI.Error.AuthAccountNotVerified(), null)
            } else {
              done(null, user)
            }
          } else {
            done(new WIKI.Error.AuthLoginFailed(), null)
          }
        } catch (err) {
          done(err, null)
        }
      })
    )
  }
}
