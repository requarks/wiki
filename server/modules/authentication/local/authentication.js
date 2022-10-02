/* global WIKI */
const bcrypt = require('bcryptjs-then')

// ------------------------------------
// Local Account
// ------------------------------------

const LocalStrategy = require('passport-local').Strategy

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
      }, async (uEmail, uPassword, done) => {
        try {
          const user = await WIKI.db.users.query().findOne({
            email: uEmail.toLowerCase()
          })
          if (user) {
            const authStrategyData = user.auth[conf.key]
            if (!authStrategyData) {
              throw new WIKI.Error.AuthLoginFailed()
            } else if (await bcrypt.compare(uPassword, authStrategyData.password) !== true) {
              throw new WIKI.Error.AuthLoginFailed()
            } else if (!user.isActive) {
              throw new WIKI.Error.AuthAccountBanned()
            } else if (!user.isVerified) {
              throw new WIKI.Error.AuthAccountNotVerified()
            } else {
              done(null, user)
            }
          } else {
            throw new WIKI.Error.AuthLoginFailed()
          }
        } catch (err) {
          done(err, null)
        }
      })
    )
  }
}
