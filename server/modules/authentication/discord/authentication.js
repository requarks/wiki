/* global WIKI */

// ------------------------------------
// Discord Account
// ------------------------------------

const DiscordStrategy = require('passport-discord').Strategy
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('discord',
      new DiscordStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        authorizationURL: 'https://discordapp.com/api/oauth2/authorize?prompt=none',
        callbackURL: conf.callbackURL,
        scope: 'identify email guilds'
      }, async (accessToken, refreshToken, profile, cb) => {
        try {
		      if (conf.guildId && !_.some(profile.guilds, { id: conf.guildId })) {
            throw new WIKI.Error.AuthLoginFailed()
          }
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
