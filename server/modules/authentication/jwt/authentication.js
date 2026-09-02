/* global WIKI */

// ------------------------------------
// JWT Token
// ------------------------------------

const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new JwtStrategy({
        algorithms: ['HS256'],
        secretOrKey: conf.jwtSecret,
        jwtFromRequest: ExtractJwt.fromUrlQueryParameter('auth_token')
      }, async (jwtPayload, cb) => {
        try {
          if (jwtPayload.iat == null) {
            throw new WIKI.Error.AuthLoginFailed()
          }
          const millisElapsed = Date.now() - jwtPayload.iat * 1000
          const minutesElapsed = Math.floor(millisElapsed / 1000 / 60)
          if (minutesElapsed > 60) {
            throw new WIKI.Error.AuthLoginFailed()
          }
          const user = await WIKI.models.users.processProfile({
            providerKey: jwtPayload.providerKey,
            profile: {
              id: jwtPayload.id,
              email: jwtPayload.email
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}
