/* global WIKI */

// ------------------------------------
// Twitch Account
// ------------------------------------

const TwitchStrategy = require('passport-twitch-oauth').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('twitch',
      new TwitchStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              picture: _.get(profile, 'avatar', '')
            },
            providerKey: 'twitch'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
