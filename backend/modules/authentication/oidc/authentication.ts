import * as client from 'openid-client'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/**
 * Generic OpenID Connect / OAuth2
 *
 * The authorization code flow with PKCE, against any provider that speaks OpenID Connect. What makes
 * it OIDC rather than bare OAuth2 is the ID token: a signed statement of who signed in, which is
 * verified here against the provider's published keys — issuer, audience, nonce and signature — before
 * anything is believed about the person behind it.
 *
 * That verification is why this goes through `openid-client` rather than a handful of `fetch` calls.
 * The requests themselves are trivial; the checks around them are where a mistake is silent, because
 * a token that is never verified still logs somebody in.
 */
export default class OidcAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  /**
   * The provider as `openid-client` sees it. Built once and kept: with discovery on it is a network
   * round trip, and it is the same answer for every login until the strategy is saved again.
   */
  private config: client.Configuration | null = null

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  /**
   * Resolve the provider's metadata.
   *
   * Discovery is the path worth taking: the endpoints AND the signing keys come from the issuer
   * itself, so a provider rotating either is followed without an administrator editing anything. The
   * manual path exists for providers that publish no discovery document, and needs the JWKS URL for
   * the same reason — without keys there is nothing to check the ID token against.
   */
  private async configuration(): Promise<client.Configuration> {
    if (this.config) {
      return this.config
    }
    const { clientId, clientSecret, issuer } = this.conf
    if (!clientId || !clientSecret || !issuer) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    if (this.conf.useDiscovery !== false) {
      this.config = await client.discovery(new URL(issuer), clientId, clientSecret)
    } else {
      if (!this.conf.authorizationURL || !this.conf.tokenURL || !this.conf.jwksURL) {
        throw new Error('ERR_STRATEGY_MISCONFIGURED')
      }
      this.config = new client.Configuration(
        {
          issuer,
          authorization_endpoint: this.conf.authorizationURL,
          token_endpoint: this.conf.tokenURL,
          userinfo_endpoint: this.conf.userInfoURL || undefined,
          jwks_uri: this.conf.jwksURL
        },
        clientId,
        clientSecret
      )
    }
    return this.config
  }

  /** Where to send the browser to sign in. */
  async authorizationUrl({ redirectUri, state, nonce, codeVerifier }: AuthFlow): Promise<string> {
    const config = await this.configuration()
    return client
      .buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: this.conf.scopes || 'openid profile email',
        state,
        nonce,
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256'
      })
      .toString()
  }

  /**
   * Turn the code the provider sent back into who signed in.
   *
   * `authorizationCodeGrant` is what does the checking: it refuses a response whose state does not
   * match the one this flow started with, exchanges the code with the PKCE verifier, and validates
   * the ID token's signature, issuer, audience and nonce. Everything after it is reading claims.
   */
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
    const claims = tokens.claims()
    if (!claims?.sub) {
      throw new Error('ERR_NO_ID_TOKEN')
    }

    /*
      The userinfo endpoint is consulted when the provider has one, because a provider is free to keep
      claims out of the ID token and behind it — several put the email address there only. Its answer
      is merged over the token's, and `fetchUserInfo` checks that it is about the same subject.
    */
    let info: Record<string, any> = claims
    if (config.serverMetadata().userinfo_endpoint) {
      info = {
        ...claims,
        ...(await client.fetchUserInfo(config, tokens.access_token, claims.sub))
      }
    }

    const email = info[this.conf.emailClaim || 'email']
    if (!email || typeof email !== 'string') {
      throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
    }
    return {
      id: claims.sub,
      email,
      name: (info[this.conf.displayNameClaim || 'name'] as string) || email
    }
  }

  /** Where a logout should continue, so that the session at the provider ends too. */
  logoutUrl(): string | null {
    return this.conf.logoutURL || null
  }
}
