/* global WIKI */

// ------------------------------------
// Discord Account
// ------------------------------------

const DiscordStrategy = require('passport-discord').Strategy
const _ = require('lodash')
const DiscordOauth2 = require('discord-oauth2')

// Checks for the existence of all of the configured role IDs in the member's guild IDs.
function hasRoles(memberRoles, authRoles) {
  if (memberRoles.every(value => {
    return authRoles.includes(value)
  })) {
    return true
  } else {
    return false
  }
};

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new DiscordStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        authorizationURL: 'https://discord.com/api/oauth2/authorize?prompt=none',
        callbackURL: conf.callbackURL,
        scope: 'identify email guilds',
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          if (conf.roles) {
            const discord = new DiscordOauth2()
            const memberRoles = await discord.getGuildMember(accessToken, conf.guildId)
            if (!hasRoles(memberRoles.roles, conf.roles)) {
              throw new WIKI.Error.AuthLoginFailed()
            }
          } else if (conf.guildId && !_.some(profile.guilds, { id: conf.guildId })) {
            throw new WIKI.Error.AuthLoginFailed()
          }

          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              displayName: profile.username,
              picture: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
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
