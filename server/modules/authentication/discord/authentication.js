/* global WIKI */

// ------------------------------------
// Discord Account
// ------------------------------------

const DiscordStrategy = require('passport-discord').Strategy
const DiscordOauth2 = require('./node_modules/discord-oauth2/index.js')
const _ = require('lodash')

// Checks for the existence of all of the required role IDs in the member's guild role IDs.
function hasRoles(memberRoles, authRoles) {
  if (authRoles.every(value => {
    return memberRoles.includes(value)
  })) {
    return true
  } else {
    return false
  }
};

module.exports = {
  init (passport, conf) {
    const discord = new DiscordOauth2()
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
            const memberRoles = await discord.getGuildMember(accessToken, conf.guildId)
            const authRoles = conf.roles.split();
            const { roles } = await discord.getGuildMember(accessToken, conf.guildId);
            if (authRoles.every(role => roles.includes(role))
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
