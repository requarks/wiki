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
            if (user.islocked) {
              // Return custom locked account error
              return done(new WIKI.Error.AuthAccountLocked(), null)
            }

            try {
              // Attempt to verify the password
              await user.verifyPassword(uPassword)

              // Reset failed attempts if login is successful
              if (user.failedattempts > 0) {
                await WIKI.models.users.query().patch({
                  failedattempts: 0
                }).where({ id: user.id })
              }

              if (!user.isActive) {
                done(new WIKI.Error.AuthAccountBanned(), null)
              } else if (!user.isVerified) {
                done(new WIKI.Error.AuthAccountNotVerified(), null)
              } else {
                done(null, user)
              }
            } catch (err) {
              // Password verification failed; increment failed attempts
              const updatedAttempts = user.failedattempts + 1
              const islocked = updatedAttempts >= 3

              await WIKI.models.users.query().patch({
                failedattempts: updatedAttempts,
                islocked: islocked
              }).where({ id: user.id })

              if (islocked) {
                // Return custom locked account error
                return done(new WIKI.Error.AuthAccountLocked(), null)
              }

              return done(new WIKI.Error.AuthLoginFailed(), null)
            }
          } else {
            // Fake verify password to mask timing differences
            await bcrypt.compare((Math.random() + 1).toString(36), '$2a$12$irXbAcQSY59pcQQfNQpY8uyhfSw48nzDikAmr60drI501nR.PuBx2')

            done(new WIKI.Error.AuthLoginFailed(), null)
          }
        } catch (err) {
          done(err, null)
        }
      })
    )
  }
}
