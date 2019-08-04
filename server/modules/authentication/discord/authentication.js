/* global WIKI */

// ------------------------------------
// Discord Account
// ------------------------------------

const DiscordStrategy = require('passport-discord').Strategy

module.exports = {
  init (passport, conf) {
    passport.use('discord',
      new DiscordStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        authorizationURL: 'https://discordapp.com/api/oauth2/authorize?prompt=none',
        callbackURL: conf.callbackURL,
        scope: 'identify email'
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
          const user = await WIKI.models.users.processProfile({
            profile: {
              ...profile,
              displayName: profile.username,
              picture: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            },
            providerKey: 'discord'
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
