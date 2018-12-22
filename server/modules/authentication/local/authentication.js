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
      }, (uEmail, uPassword, done) => {
        WIKI.models.users.query().findOne({
          email: uEmail,
          providerKey: 'local'
        }).then((user) => {
          if (user) {
            return user.verifyPassword(uPassword).then(() => {
              if (!user.isActive) {
                done(new WIKI.Error.AuthAccountBanned(), null)
              } else if (!user.isVerified) {
                done(new WIKI.Error.AuthAccountNotVerified(), null)
              } else {
                done(null, user)
              }
            }).catch((err) => {
              done(err, null)
            })
          } else {
            done(new WIKI.Error.AuthLoginFailed(), null)
          }
        }).catch((err) => {
          done(err, null)
        })
      }
      ))
  }
}
