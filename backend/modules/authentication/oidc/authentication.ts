import * as client from 'openid-client'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/**
 * OpenID Connect / OAuth2
 *
 * The authorization code flow with PKCE, against any provider that speaks OpenID Connect. What makes
 * it OIDC rather than bare OAuth2 is the ID token: a signed statement of who signed in, which is
 * verified here against the provider's published keys — issuer, audience, nonce and signature — before
 * anything is believed about the person behind it.
 *
 * That verification is why this goes through `openid-client` rather than a handful of `fetch` calls.
 * The requests themselves are trivial; the checks around them are where a mistake is silent, because
 * a token that is never verified still logs somebody in.
 *
 * Everything past the verification is reading claims, and which claim carries what is configurable
 * throughout — providers agree on the flow far more than they agree on their vocabulary.
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
    // -> After either branch: which endpoint the userinfo request goes to is what discovery answers,
    //    and how the token is presented to it is a separate question with the same answer either way
    if (this.conf.useQueryStringForAccessToken === true) {
      this.accessTokenInQueryString(this.config)
    }
    return this.config
  }

  /**
   * Move the access token out of the Authorization header and onto the userinfo request's query
   * string, as `access_token`.
   *
   * Both are ways OAuth2 defines of presenting a bearer token, and the header is the one to use — the
   * query string puts a live credential in every access log and referrer between here and the
   * provider, which is why the spec discourages it. It is offered because some providers read the
   * token from nowhere else, which has nothing to do with whether they publish a discovery document.
   *
   * The request is rewritten rather than written out again, because reimplementing the call would
   * mean reimplementing its subject check and its signed-response handling too, and a userinfo answer
   * nobody checked may be about somebody else.
   */
  private accessTokenInQueryString(config: client.Configuration): void {
    const endpoint = config.serverMetadata().userinfo_endpoint
    // -> The library asks for the endpoint's `href`, so the configured string is normalized once here
    //    rather than compared as it was typed
    const userInfoHref = endpoint ? new URL(endpoint).href : null
    config[client.customFetch] = (url, options) => {
      // -> Only a Bearer presentation is moved: a DPoP-bound token is not a credential the query
      //    string can carry, and every other request the library makes is somebody else's business
      const bearer = /^Bearer (.+)$/.exec(options.headers.authorization ?? '')?.[1]
      if (!userInfoHref || !bearer || new URL(url).href !== userInfoHref) {
        return fetch(url, options)
      }
      const target = new URL(url)
      target.searchParams.set('access_token', bearer)
      const headers = { ...options.headers }
      delete headers.authorization
      return fetch(target, { ...options, headers })
    }
  }

  /**
   * Where to send the browser to sign in.
   *
   * `acr_values` asks the provider for a kind of authentication rather than telling it to use one:
   * OpenID Connect makes the parameter voluntary, and the context actually satisfied comes back as
   * the `acr` claim. So it goes on the request here and is checked again in `profile()` — the same
   * division the Google module makes for a Workspace domain.
   */
  async authorizationUrl({ redirectUri, state, nonce, codeVerifier }: AuthFlow): Promise<string> {
    const config = await this.configuration()
    const acr = this.acrValues()
    return client
      .buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: this.conf.scopes || 'openid profile email',
        state,
        nonce,
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        ...(acr.length > 0 ? { acr_values: acr.join(' ') } : {})
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
    // -> Before the userinfo round trip: no point spending one on a login already being refused
    this.checkAuthContext(claims)

    /*
      The userinfo endpoint is consulted when the provider has one, because a provider is free to keep
      claims out of the ID token and behind it — several put the email address there only, and group
      membership is behind it more often than not. Its answer is merged over the token's, and
      `fetchUserInfo` checks that it is about the same subject.
    */
    let info: Record<string, any> = claims
    if (config.serverMetadata().userinfo_endpoint) {
      info = {
        ...claims,
        ...(await client.fetchUserInfo(config, tokens.access_token, claims.sub))
      }
    }

    /*
      `sub` is the identifier OIDC guarantees is stable and never reassigned, and is what this reads
      unless an administrator names another claim. Whichever it is, it is what the account is linked
      by from here on — the ID token's own subject stays what the library verified the answer against.
    */
    const id = info[this.conf.idClaim || 'sub']
    if (!id || typeof id !== 'string') {
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }
    const email = info[this.conf.emailClaim || 'email']
    if (!email || typeof email !== 'string') {
      throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
    }
    return {
      id,
      email,
      name: (info[this.conf.displayNameClaim || 'name'] as string) || email,
      picture: this.pictureFrom(info),
      // -> Absent rather than empty when groups are not mapped: an empty list is the provider saying
      //    this person is in none, which with `unassignMissingGroups` on takes memberships away
      ...(this.conf.mapGroups === true
        ? {
            groups: this.groupsFrom(info),
            groupsExclusive: this.conf.unassignMissingGroups === true
          }
        : {})
    }
  }

  /**
   * The authentication contexts this wiki asks for, most preferred first.
   *
   * Empty unless the setting is on, so turning it off stops asking rather than leaving whatever was
   * typed on every request.
   */
  private acrValues(): string[] {
    if (this.conf.useAcrValues !== true) {
      return []
    }
    return String(this.conf.acrValues || '')
      .split(/\s+/)
      .filter((one) => one.length > 0)
  }

  /**
   * Hold the provider to the authentication context that was asked for.
   *
   * Read from the ID TOKEN's claims and not from the merged userinfo answer, deliberately: `acr` is a
   * statement about how the person authenticated, and the only thing entitled to make it is the
   * document the provider signed. A userinfo response is fetched with an access token and must not be
   * able to assert its own authentication context.
   *
   * Strict about the shape as well as the value. `acr` is a single string in the spec, so anything
   * else — absent, an array from a provider that has misread it — counts as not satisfied: this is the
   * check that stands between a wiki and a login weaker than it asked for, and the useful direction
   * for it to fail in is closed.
   *
   * @throws `ERR_ACR_NOT_SATISFIED`, or `ERR_STRATEGY_MISCONFIGURED` when the requirement is turned
   *         on with nothing named to require
   */
  private checkAuthContext(claims: Record<string, any>): void {
    if (this.conf.useAcrValues !== true || this.conf.requireAcr !== true) {
      return
    }
    const wanted = this.acrValues()
    if (wanted.length < 1) {
      // -> Fails closed. "Require the context" with no context named cannot be satisfied or refuted,
      //    and silently letting everybody through is the one answer that must not be given.
      WIKI.logger.warn(
        `OIDC strategy ${this.strategyId} requires an authentication context but names none — refusing logins until ACR Values is filled in or the requirement is turned off.`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    const satisfied = claims.acr
    if (typeof satisfied !== 'string' || !wanted.includes(satisfied)) {
      WIKI.logger.warn(
        `OIDC strategy ${this.strategyId} refused a login: asked for acr ${wanted.join(' ')}, the provider answered ${JSON.stringify(satisfied) ?? 'nothing'}.`
      )
      throw new Error('ERR_ACR_NOT_SATISFIED')
    }
  }

  /**
   * The URL of the account's picture, if the claim carrying it names one.
   *
   * An empty claim name turns this off, which is how a wiki lets people keep an avatar they chose
   * here rather than having it replaced at every sign-in.
   */
  private pictureFrom(info: Record<string, any>): string | undefined {
    const claim = this.conf.pictureClaim ?? 'picture'
    if (!claim) {
      return undefined
    }
    const value = info[claim]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  /**
   * The group names the claim carries.
   *
   * Either one name or a list of them: a provider with a single group per account commonly sends the
   * bare string, and both forms mean the same thing here. Anything else in the list — a nested object
   * from a provider that sends group records rather than names — is skipped rather than stringified,
   * since a name that matches nothing is a membership silently not granted.
   */
  private groupsFrom(info: Record<string, any>): string[] {
    const value = info[this.conf.groupsClaim || 'groups']
    const raw = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
    return raw
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
  }

  /**
   * Where a logout should continue, so that the session at the provider ends too.
   *
   * Discovered when discovery is on, which is why the field is only asked for when it is off: the
   * `end_session_endpoint` is published in the same document as every other endpoint, and a provider
   * that moves it is then followed without an administrator editing anything. Null when the provider
   * publishes none — plenty do not, and RP-initiated logout is optional in the spec.
   *
   * Sent as it stands, with no `id_token_hint` or `post_logout_redirect_uri`: neither is required,
   * and where a provider asks the person to confirm the sign-out because of it, confirming is not the
   * failure mode worth adding stored ID tokens to avoid.
   */
  async logoutUrl(): Promise<string | null> {
    if (this.conf.useDiscovery === false) {
      return this.conf.logoutURL || null
    }
    return (await this.configuration()).serverMetadata().end_session_endpoint ?? null
  }
}
