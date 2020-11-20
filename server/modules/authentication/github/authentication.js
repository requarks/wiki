/* global WIKI */

// ------------------------------------
// GitHub Account
// ------------------------------------

const GitHubStrategy = require('passport-github2').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    let githubConfig = {
      clientID: conf.clientId,
      clientSecret: conf.clientSecret,
      callbackURL: conf.callbackURL,
      scope: ['user:email'],
      passReqToCallback: true
    }

    if (conf.useEnterprise) {
      githubConfig.authorizationURL = `https://${conf.enterpriseDomain}/login/oauth/authorize`
      githubConfig.tokenURL = `https://${conf.enterpriseDomain}/login/oauth/access_token`
      githubConfig.userProfileURL = conf.enterpriseUserEndpoint
      githubConfig.userEmailURL = `${conf.enterpriseUserEndpoint}/emails`
    }

    passport.use('github',
      new GitHubStrategy(githubConfig, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              picture: _.get(profile, 'photos[0].value', '')
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
