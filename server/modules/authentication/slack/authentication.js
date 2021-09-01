/* global WIKI */

// ------------------------------------
// Slack Account
// ------------------------------------

const SlackStrategy = require('passport-slack-oauth2').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('slack',
      new SlackStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        team: conf.team,
        scope: ['identity.basic', 'identity.email', 'identity.avatar'],
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, { user: userProfile }, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...userProfile,
              picture: _.get(userProfile, 'image_48', '')
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
