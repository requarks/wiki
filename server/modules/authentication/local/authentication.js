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
        WIKI.db.users.query().findOne({
          email: uEmail,
          provider: 'local'
        }).then((user) => {
          if (user) {
            return user.verifyPassword(uPassword).then(() => {
              done(null, user)
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
