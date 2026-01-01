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

    passport.use(conf.key,
      new GitHubStrategy(githubConfig, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          WIKI.logger.info(`GitHub OAuth: Processing profile for user ${profile.id || profile.username}`)
          
          // Ensure email is available - passport-github2 should fetch it automatically with user:email scope
          // but we'll log a warning if it's missing
          if (!profile.emails || (Array.isArray(profile.emails) && profile.emails.length === 0)) {
            WIKI.logger.warn(`GitHub OAuth: No email found in profile for user ${profile.id || profile.username}. Make sure 'user:email' scope is granted.`)
          }

          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              picture: _.get(profile, 'photos[0].value', '')
            }
          })
          
          WIKI.logger.info(`GitHub OAuth: Successfully authenticated user ${user.email}`)
          cb(null, user)
        } catch (err) {
          WIKI.logger.warn(`GitHub OAuth: Authentication failed for strategy ${req.params.strategy}:`, err)
          // Provide more user-friendly error messages
          if (err.message && err.message.includes('email')) {
            cb(new Error('GitHub authentication failed: Email address is required but not available. Please ensure your GitHub account has a verified email address and grant email access permissions.'), null)
          } else if (err instanceof WIKI.Error.AuthAccountBanned) {
            cb(err, null)
          } else {
            cb(new Error(`GitHub authentication failed: ${err.message || 'Unknown error'}`), null)
          }
        }
      }
      ))
  }
}
