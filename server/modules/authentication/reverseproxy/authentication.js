/* global WIKI */

// ------------------------------------
// Reverse Proxy Header
// ------------------------------------

const ReverseProxyStrategy = require('passport-reverseproxy')

module.exports = {
  init (passport, conf) {
    passport.use('reverseproxy',
      new ReverseProxyStrategy({
        headers: { [conf.userEmailHeader]: { alias: 'email', required: true } },
        whitelist: conf.ipWhitelist
      }, async (headers, userData, done) => {
        try {
          const user = await WIKI.models.users.query().findOne({
            email: userData.email.toLowerCase(),
            providerKey: 'local'
          })
          if (user) {
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

