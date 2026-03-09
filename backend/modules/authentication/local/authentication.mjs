/* global WIKI */
import bcrypt from 'bcryptjs'

// ------------------------------------
// Local Account
// ------------------------------------
export default class LocalAuthentication {
  constructor(strategyId, conf) {
    this.strategyId = strategyId
    this.conf = conf
  }

  async authenticate({ username, password }) {
    const user = await WIKI.models.users.getByEmail(username.toLowerCase())
    if (user) {
      const authStrategyData = user.auth[this.strategyId]
      if (!authStrategyData) {
        throw new Error('ERR_INVALID_STRATEGY')
      } else if ((await bcrypt.compare(password, authStrategyData.password)) !== true) {
        throw new Error('ERR_LOGIN_FAILED')
      } else if (!user.isActive) {
        throw new Error('ERR_INACTIVE_USER')
      } else if (authStrategyData.restrictLogin) {
        throw new Error('ERR_LOGIN_RESTRICTED')
      } else if (!user.isVerified) {
        throw new Error('ERR_USER_NOT_VERIFIED')
      } else {
        return user
      }
    } else {
      throw new Error('ERR_LOGIN_FAILED')
    }
  }
}
