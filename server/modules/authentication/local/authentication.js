const bcrypt = require('bcryptjs-then')

/* global WIKI */

// ------------------------------------
// Local Account
// ------------------------------------

const LocalStrategy = require('passport-local').Strategy

module.exports = {
  init(passport, conf) {
    passport.use('local',
      new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
      }, async (uEmail, uPassword, done) => {
        try {
          const user = await WIKI.models.users.query().findOne({
            email: uEmail.toLowerCase(),
            providerKey: 'local'
          })

          if (user) {
            if (user.isLocked) {
              return done(new WIKI.Error.AuthAccountLocked(), null)
            }

            try {
              await user.verifyPassword(uPassword)

              if (user.failedAttempts > 0) {
                await WIKI.models.users.resetFailedAttempts(user.id)
              }

              if (!user.isActive) {
                return done(new WIKI.Error.AuthAccountBanned(), null)
              } else if (!user.isVerified) {
                return done(new WIKI.Error.AuthAccountNotVerified(), null)
              } else {
                return done(null, user)
              }
            } catch (err) {
              const isLocked = await WIKI.models.users.incrementFailedAttempts(user.email)

              if (isLocked) {
                return done(new WIKI.Error.AuthAccountLocked(), null)
              }
              return done(new WIKI.Error.AuthLoginFailed(), null)
            }
          } else {
            // Fake verify password to mask timing differences
            await bcrypt.compare((Math.random() + 1).toString(36), '$2a$12$irXbAcQSY59pcQQfNQpY8uyhfSw48nzDikAmr60drI501nR.PuBx2')

            return done(new WIKI.Error.AuthLoginFailed(), null)
          }
        } catch (err) {
          return done(err, null)
        }
      })
    )
  }
}
