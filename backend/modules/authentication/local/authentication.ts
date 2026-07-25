/* global WIKI */
import bcrypt from 'bcryptjs'

// ------------------------------------
// Local Account
// ------------------------------------
export default class LocalAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by models/authentication.ts right after construction. */
  module?: string

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  async authenticate({ username, password }: { username: string; password: string }): Promise<any> {
    const user = await WIKI.models.users.getByEmail(username.toLowerCase())
    if (user) {
      const authStrategyData = (user.auth as Record<string, any>)[this.strategyId]
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
