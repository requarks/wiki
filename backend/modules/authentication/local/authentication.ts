import bcrypt from 'bcryptjs'
import { strategyDebug } from '../../../helpers/authDebug.ts'

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

  /**
   * Whether this is the account's own password, and whether the account may use it.
   *
   * Each refusal is logged under the auth debug flag, because the login screen is told apart only two
   * of these six: an account that does not exist, one that exists but signs in through some other
   * strategy, and one whose password is simply wrong all reach the user as the same failure. Which it
   * was is what an administrator being told "it will not let me in" needs.
   */
  async authenticate({ username, password }: { username: string; password: string }): Promise<any> {
    const email = username.toLowerCase()
    const user = await WIKI.models.users.getByEmail(email)
    if (!user) {
      strategyDebug(this, `no account here has the address <${email}>`)
      throw new Error('ERR_LOGIN_FAILED')
    }
    const authStrategyData = (user.auth as Record<string, any>)[this.strategyId]
    if (!authStrategyData) {
      strategyDebug(
        this,
        `user ${user.id} <${user.email}> has no password for this strategy — the account signs in through another one`
      )
      throw new Error('ERR_INVALID_STRATEGY')
    }
    if ((await bcrypt.compare(password, authStrategyData.password)) !== true) {
      strategyDebug(this, `user ${user.id} <${user.email}> gave the wrong password`)
      throw new Error('ERR_LOGIN_FAILED')
    }
    if (!user.isActive) {
      strategyDebug(
        this,
        `user ${user.id} <${user.email}> gave the right password, but the account is deactivated`
      )
      throw new Error('ERR_INACTIVE_USER')
    }
    if (authStrategyData.restrictLogin) {
      strategyDebug(
        this,
        `user ${user.id} <${user.email}> gave the right password, but the account is barred from signing in`
      )
      throw new Error('ERR_LOGIN_RESTRICTED')
    }
    if (!user.isVerified) {
      strategyDebug(
        this,
        `user ${user.id} <${user.email}> gave the right password, but the address has never been confirmed`
      )
      throw new Error('ERR_USER_NOT_VERIFIED')
    }
    strategyDebug(this, `user ${user.id} <${user.email}> gave the right password`)
    return user
  }
}
