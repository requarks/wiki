/* global WIKI */

// ------------------------------------
// GitHub Account
// ------------------------------------

const GitHubStrategy = require('passport-github2').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('github',
      new GitHubStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        scope: ['user:email']
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              picture: _.get(profile, 'photos[0].value', '')
            },
            providerKey: 'github'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
