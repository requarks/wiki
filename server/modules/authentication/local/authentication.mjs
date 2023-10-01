/* global WIKI */
import bcrypt from 'bcryptjs'

// ------------------------------------
// Local Account
// ------------------------------------

import { Strategy } from 'passport-local'

export default {
  init (passport, strategyId, conf) {
    passport.use(strategyId,
      new Strategy({
        usernameField: 'email',
        passwordField: 'password'
      }, async (uEmail, uPassword, done) => {
        try {
          const user = await WIKI.db.users.query().findOne({
            email: uEmail.toLowerCase()
          })
          if (user) {
            const authStrategyData = user.auth[strategyId]
            if (!authStrategyData) {
              throw new Error('ERR_INVALID_STRATEGY_ID')
            } else if (await bcrypt.compare(uPassword, authStrategyData.password) !== true) {
              throw new Error('ERR_AUTH_FAILED')
            } else if (!user.isActive) {
              throw new Error('ERR_INACTIVE_USER')
            } else if (authStrategyData.restrictLogin) {
              throw new Error('ERR_LOGIN_RESTRICTED')
            } else if (!user.isVerified) {
              throw new Error('ERR_USER_NOT_VERIFIED')
            } else {
              done(null, user)
            }
          } else {
            throw new Error('ERR_AUTH_FAILED')
          }
        } catch (err) {
          done(err, null)
        }
      })
    )
  }
}
