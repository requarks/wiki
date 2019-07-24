/* global WIKI */

// ------------------------------------
// GitLab Account
// ------------------------------------

const GitLabStrategy = require('passport-gitlab2').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('gitlab',
      new GitLabStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        baseURL: conf.baseUrl,
        scope: ['read_user']
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              picture: _.get(profile, 'avatarUrl', '')
            },
            providerKey: 'gitlab'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
