/* global WIKI */

// ------------------------------------
// Local Account
// ------------------------------------

const LocalStrategy = require('passport-local').Strategy

module.exports = {
  key: 'local',
  title: 'Local',
  useForm: true,
  props: [],
  init (passport, conf) {
    passport.use('local',
      new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
      }, (uEmail, uPassword, done) => {
        WIKI.db.User.findOne({
          where: {
            email: uEmail,
            provider: 'local'
          }
        }).then((user) => {
          if (user) {
            return user.validatePassword(uPassword).then(() => {
              return done(null, user) || true
            }).catch((err) => {
              return done(err, null)
            })
          } else {
            return done(new WIKI.Error.AuthLoginFailed(), null)
          }
        }).catch((err) => {
          done(err, null)
        })
      }
      ))
  }
}
