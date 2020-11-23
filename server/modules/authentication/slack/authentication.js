/* global WIKI */

// ------------------------------------
// Slack Account
// ------------------------------------

const SlackStrategy = require('@aoberoi/passport-slack').default.Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('slack',
      new SlackStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        team: conf.team,
        passReqToCallback: true
      }, async (req, accessToken, scopes, team, extra, { user: userProfile }, cb) => {
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
