/* global WIKI */

// ------------------------------------
// Twitch Account
// ------------------------------------

const TwitchStrategy = require('passport-twitch-strategy').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new TwitchStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL: conf.callbackURL,
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              picture: _.get(profile, 'profile_image_url', '')
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
