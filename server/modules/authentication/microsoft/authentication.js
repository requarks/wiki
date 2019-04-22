/* global WIKI */

// ------------------------------------
// Microsoft Account
// ------------------------------------

const WindowsLiveStrategy = require('passport-windowslive').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('microsoft',
      new WindowsLiveStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, async (accessToken, refreshToken, profile, cb) => {
        console.info(profile)
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              picture: _.get(profile, 'photos[0].value', '')
            },
            providerKey: 'microsoft'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
