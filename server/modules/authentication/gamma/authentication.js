/* global WIKI */

// ------------------------------------
// Gamma Account
// ------------------------------------

const GammaStrategy = require('./strategy')
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    let strategy = new GammaStrategy({
      authorizationURL: conf.authorizationUrl,
      tokenURL: conf.tokenUrl,
      clientID: conf.clientId,
      clientSecret: conf.clientSecret,
      callbackURL: conf.callbackURL,
      profileURL: conf.profileURL
    }, async (accessToken, profile, cb) => {
      try {
        const user = await WIKI.models.users.processProfile({
          profile: {
            id: profile.id,
            username: profile.cid,
            displayName: profile.nick,
            name: `${profile.firstName} ${profile.lastName}`,
            gender: null,
            profileUrl: `https://gamma.chalmers.it/users/${profile.cid}`,
            picture: profile.avatarUrl,
            email: profile.email
          },
          providerKey: 'gamma'
        })
        cb(null, user)
      } catch (err) {
        cb(err, null)
      }
    }
    )

    passport.use('gamma', strategy)
  }
}
