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
      scope: ['user:email']
    }

    if (conf.useEnterprise) {
      githubConfig.authorizationURL = `https://${conf.enterpriseDomain}/login/oauth/authorize`
      githubConfig.tokenURL = `https://${conf.enterpriseDomain}/login/oauth/access_token`
      githubConfig.userProfileURL = conf.enterpriseUserEndpoint
      githubConfig.userEmailURL = `${conf.enterpriseUserEndpoint}/emails`
    }

    passport.use('github',
      new GitHubStrategy(githubConfig, async (accessToken, refreshToken, profile, cb) => {
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
