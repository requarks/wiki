import * as client from 'openid-client'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/** Google's issuer, from which every endpoint and signing key is discovered. */
const ISSUER = 'https://accounts.google.com'

/**
 * Google
 *
 * Google is an OpenID Connect provider, so this is the generic flow with the issuer fixed and two
 * things Google specifically needs saying about:
 *
 *   - a Workspace domain can be required, and the claim is checked HERE as well as asked for — `hd`
 *     on the authorization request is a hint to the account chooser, not a promise about the answer;
 *   - `email_verified` is honoured, because an account on this wiki is matched by email address and
 *     an unverified one says nothing about who holds the mailbox.
 *
 * Written against `openid-client` rather than by hand for the reason the generic module is: the ID
 * token has to be verified, and a token nobody verified still logs somebody in.
 */
export default class GoogleAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  private config: client.Configuration | null = null

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  private async configuration(): Promise<client.Configuration> {
    if (this.config) {
      return this.config
    }
    if (!this.conf.clientId || !this.conf.clientSecret) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    this.config = await client.discovery(
      new URL(ISSUER),
      this.conf.clientId,
      this.conf.clientSecret
    )
    return this.config
  }

  async authorizationUrl({ redirectUri, state, nonce, codeVerifier }: AuthFlow): Promise<string> {
    const config = await this.configuration()
    return client
      .buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: 'openid profile email',
        state,
        nonce,
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        // -> Which accounts the chooser offers. The answer is still checked below.
        ...(this.conf.hostedDomain ? { hd: this.conf.hostedDomain } : {})
      })
      .toString()
  }

  async profile({
    currentUrl,
    state,
    nonce,
    codeVerifier
  }: AuthFlowCallback): Promise<ProviderProfile> {
    const config = await this.configuration()
    const tokens = await client.authorizationCodeGrant(config, new URL(currentUrl), {
      expectedState: state,
      expectedNonce: nonce,
      pkceCodeVerifier: codeVerifier
    })
    const claims = tokens.claims() as Record<string, any> | undefined
    if (!claims?.sub) {
      throw new Error('ERR_NO_ID_TOKEN')
    }

    const email = claims.email
    if (!email || typeof email !== 'string') {
      throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
    }
    if (claims.email_verified === false && this.conf.allowUnverifiedEmail !== true) {
      throw new Error('ERR_EMAIL_NOT_VERIFIED')
    }
    if (this.conf.hostedDomain && claims.hd !== this.conf.hostedDomain) {
      throw new Error('ERR_LOGIN_RESTRICTED')
    }

    return {
      id: claims.sub,
      email,
      name: (claims.name as string) || email
    }
  }
}
