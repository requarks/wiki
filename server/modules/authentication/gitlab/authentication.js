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
        scope: ['read_user'],
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              picture: _.get(profile, 'avatarUrl', '')
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
