import { createHash } from 'node:crypto'
import { isPlainObject } from 'es-toolkit/predicate'
import { profileFromClaims } from '../../../helpers/authClaims.ts'
import { missingSettings, strategyDebug } from '../../../helpers/authDebug.ts'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/**
 * How long one request to the provider may take. Node's `fetch` has no timeout of its own, and a
 * provider that accepts the connection and never answers would otherwise hold the login open until a
 * socket gave up.
 */
const REQUEST_TIMEOUT_MS = 30_000

/** The endpoints, by the titles the admin area shows them under. */
const ENDPOINT_SETTINGS = {
  authorizationURL: 'Authorization Endpoint URL',
  tokenURL: 'Token Endpoint URL',
  userInfoURL: 'User Info Endpoint URL'
} as const
type EndpointKey = keyof typeof ENDPOINT_SETTINGS

interface Settings {
  clientId: string
  clientSecret: string
  endpoints: Record<EndpointKey, URL>
}

/**
 * One value form-encoded on its own, as RFC 6749 section 2.3.1 asks the client ID and secret to be
 * before they are joined into a Basic credential. `URLSearchParams` serializes with exactly the
 * `application/x-www-form-urlencoded` rules, which `encodeURIComponent` does not.
 */
function formEncode(value: string): string {
  return new URLSearchParams([['', value]]).toString().slice(1)
}

/**
 * OAuth2
 *
 * The authorization code flow against a provider that speaks OAuth 2.0 and not OpenID Connect: there
 * is no ID token, so nothing signed says who signed in. The code is exchanged for an access token
 * directly with the token endpoint, over TLS and with the client secret, and the token is then spent
 * against a user info endpoint, which answers who it belongs to. That is the same footing the GitHub
 * and Discord modules stand on, with the endpoints and the vocabulary configurable instead of known —
 * Mattermost and Rocket.Chat are the providers it was written for.
 *
 * Not built on `openid-client`, which the OIDC module is, because that library is about the ID token
 * and holds a userinfo answer to OpenID Connect's shape: one without a `sub` is refused outright, and
 * Mattermost's has none. The requests themselves are a handful of `fetch` calls; `state`, and keeping
 * the client secret off the browser, are the flow's job (`api/authentication.ts`).
 *
 * Reading the answer is shared with the OIDC module (`helpers/authClaims.ts`), so a provider is held
 * to the same rules about identifiers, addresses and groups whichever of the two signs it in.
 */
export default class OAuth2Authentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  /**
   * The strategy's settings, refused if they cannot describe a login.
   *
   * Every endpoint is checked here rather than where it is used, so a strategy with one mistyped
   * fails at the first login with the field named, not halfway through one with a fetch error. Plain
   * HTTP is refused for all three unless the strategy allows it: the authorization endpoint's answer
   * carries the code back through the browser, and the other two carry the client secret and the
   * token.
   *
   * @throws `ERR_STRATEGY_MISCONFIGURED`
   */
  private settings(): Settings {
    const clientId = (this.conf.clientId || '').trim()
    const clientSecret = this.conf.clientSecret || ''
    const raw = Object.fromEntries(
      Object.keys(ENDPOINT_SETTINGS).map((key) => [key, String(this.conf[key] || '').trim()])
    ) as Record<EndpointKey, string>
    if (!clientId || !clientSecret || !raw.authorizationURL || !raw.tokenURL || !raw.userInfoURL) {
      strategyDebug(
        this,
        `is not configured: ${missingSettings({
          'Client ID': clientId,
          'Client Secret': clientSecret,
          ...Object.fromEntries(
            Object.entries(ENDPOINT_SETTINGS).map(([key, title]) => [
              title,
              raw[key as EndpointKey]
            ])
          )
        })}`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    const endpoints = {} as Record<EndpointKey, URL>
    for (const [key, title] of Object.entries(ENDPOINT_SETTINGS) as [EndpointKey, string][]) {
      const url = URL.canParse(raw[key]) ? new URL(raw[key]) : null
      if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
        strategyDebug(this, `${title} is not an http(s) URL: ${raw[key]}`)
        throw new Error('ERR_STRATEGY_MISCONFIGURED')
      }
      if (url.protocol === 'http:' && this.conf.allowInsecureHttp !== true) {
        strategyDebug(
          this,
          `${title} is plain HTTP (${url.origin}), which this strategy refuses unless Allow Insecure HTTP is on`
        )
        throw new Error('ERR_STRATEGY_MISCONFIGURED')
      }
      endpoints[key] = url
    }
    return { clientId, clientSecret, endpoints }
  }

  /** Whether the flow carries a PKCE challenge. On unless the strategy turns it off. */
  private get usePkce(): boolean {
    return this.conf.usePkce !== false
  }

  /**
   * `fetch`, bounded, with an unreachable provider reported as a provider failure rather than as
   * itself.
   *
   * A rejected fetch carries a message about sockets and DNS, and the callback route puts whatever it
   * caught into the URL it redirects to — so left alone, "fetch failed" is what the person trying to
   * log in reads. Every call this module makes goes through here for that reason.
   *
   * @param label What to call the request in the log. Never the URL itself: the user info request
   *              may carry the access token in its query string.
   */
  private async reach(url: URL, init: RequestInit, label: string): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch (err: any) {
      WIKI.logger.warn(
        `OAuth2 strategy ${this.strategyId} could not reach the ${label} at ${url.origin}${url.pathname}: ${err.message}`
      )
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
  }

  async authorizationUrl({ redirectUri, state, codeVerifier }: AuthFlow): Promise<string> {
    const { clientId, endpoints } = this.settings()
    // -> A copy, so whatever query the administrator configured the endpoint with stays on it
    const url = new URL(endpoints.authorizationURL)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    const scopes = String(this.conf.scopes || '')
      .split(/\s+/)
      .filter((one) => one.length > 0)
    if (scopes.length > 0) {
      url.searchParams.set('scope', scopes.join(' '))
    }
    if (this.usePkce) {
      url.searchParams.set(
        'code_challenge',
        createHash('sha256').update(codeVerifier).digest('base64url')
      )
      url.searchParams.set('code_challenge_method', 'S256')
    }
    return url.toString()
  }

  async profile({ code, redirectUri, codeVerifier }: AuthFlowCallback): Promise<ProviderProfile> {
    const settings = this.settings()
    if (!code) {
      throw new Error('ERR_NO_AUTHORIZATION_CODE')
    }
    const accessToken = await this.exchangeCode(settings, code, redirectUri, codeVerifier)
    const info = await this.userInfo(settings.endpoints.userInfoURL, accessToken)
    strategyDebug(this, `the provider says: ${Object.keys(info).join(', ')}`)
    return profileFromClaims(this, info, { idClaim: 'id' })
  }

  /**
   * Exchange the authorization code for an access token.
   *
   * The client authenticates one way only, as RFC 6749 section 2.3 requires: some providers refuse a
   * request that presents the credentials twice, and which one a provider reads is something it
   * decides, not this.
   *
   * @throws `ERR_TOKEN_EXCHANGE_FAILED`
   */
  private async exchangeCode(
    { clientId, clientSecret, endpoints }: Settings,
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
    if (this.usePkce) {
      body.set('code_verifier', codeVerifier)
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'Wiki.js'
    }
    if (this.conf.clientAuthMethod === 'basic') {
      headers.Authorization = `Basic ${Buffer.from(`${formEncode(clientId)}:${formEncode(clientSecret)}`).toString('base64')}`
    } else {
      body.set('client_id', clientId)
      body.set('client_secret', clientSecret)
    }
    const resp = await this.reach(
      endpoints.tokenURL,
      { method: 'POST', headers, body: body.toString() },
      'token endpoint'
    )

    /*
      JSON is what RFC 6749 specifies, and what was asked for. Some providers answer in form encoding
      regardless of `Accept` — GitHub's own does without it — and that says the same thing, so it is
      read too. Anything else is something answering on the provider's behalf, a proxy or a captive
      portal, which is a failed exchange and not a parse error to hand to whoever is logging in.
    */
    const text = await resp.text().catch(() => '')
    const contentType = resp.headers.get('content-type') ?? ''
    let token: Record<string, any> | null = null
    if (contentType.includes('application/x-www-form-urlencoded')) {
      token = Object.fromEntries(new URLSearchParams(text))
    } else {
      try {
        const parsed: unknown = JSON.parse(text)
        token = isPlainObject(parsed) ? parsed : null
      } catch {
        token = null
      }
    }
    if (!token) {
      // -> The status and type only: the body of an answer that did parse could hold a token
      strategyDebug(
        this,
        `the token exchange answered ${resp.status} with ${contentType || 'no content type'}, which is not a token response — is something else answering at ${endpoints.tokenURL.origin}?`
      )
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }
    if (!resp.ok || token.error || typeof token.access_token !== 'string' || !token.access_token) {
      // -> The provider's own account of the refusal, which names the cause: `invalid_client` for a
      //    rotated secret or the wrong Client Authentication, `invalid_grant` for a Redirect URI it
      //    does not have registered or a PKCE verifier it did not expect
      strategyDebug(
        this,
        `the token exchange answered ${resp.status}: ${[token.error, token.error_description].filter(Boolean).join(': ') || 'no access token'}`
      )
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }
    /*
      The token is presented to the user info endpoint as a bearer token, so one of any other type —
      a DPoP- or MAC-bound token — cannot be used, and saying so here beats a 401 there. A missing
      `token_type` is let through: it is required by the spec, and left out by enough providers that
      are bearer-only regardless of what they say.
    */
    if (typeof token.token_type === 'string' && token.token_type.toLowerCase() !== 'bearer') {
      strategyDebug(
        this,
        `the token exchange issued a \`${token.token_type}\` token, and only a bearer token can be spent on the user info endpoint`
      )
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }
    return token.access_token
  }

  /**
   * Ask the user info endpoint who the access token belongs to.
   *
   * What it answers is the whole of what this module knows about the person — there is no ID token
   * to check it against — and it is believed because the token was just issued to this wiki by the
   * provider's own token endpoint, over TLS. So the answer has to be a JSON object, and anything else
   * fails the login rather than being read as an account with no fields.
   *
   * @throws `ERR_PROVIDER_REQUEST_FAILED`, or `ERR_NO_PROVIDER_ACCOUNT` for an answer that is JSON
   *         but not an object
   */
  private async userInfo(endpoint: URL, accessToken: string): Promise<Record<string, any>> {
    const target = new URL(endpoint)
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Wiki.js'
    }
    // -> The header is the one to use; the query string puts a live credential in every access log
    //    between here and the provider, and is offered for providers that read it from nowhere else
    if (this.conf.useQueryStringForAccessToken === true) {
      target.searchParams.set('access_token', accessToken)
    } else {
      headers.Authorization = `Bearer ${accessToken}`
    }
    const resp = await this.reach(target, { headers }, 'user info endpoint')
    if (!resp.ok) {
      // -> The body as well as the status: a provider's error payload names the scope that was not
      //    granted or the token it did not accept, which the status alone does not
      strategyDebug(
        this,
        `the user info endpoint answered ${resp.status}: ${await resp.text().catch(() => '(no body)')}`
      )
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
    let info: unknown
    try {
      info = await resp.json()
    } catch {
      strategyDebug(
        this,
        `the user info endpoint answered ${resp.status} with ${resp.headers.get('content-type') || 'no content type'}, which is not JSON`
      )
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
    if (!isPlainObject(info)) {
      strategyDebug(
        this,
        `the user info endpoint answered with JSON that is not an object, so it describes no account`
      )
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }
    return info
  }

  /**
   * Where a logout should continue, so that the session at the provider ends too.
   *
   * Plain OAuth2 defines no logout at all, so this is whatever URL the administrator configured, sent
   * as it is. Null when there is none, and the wiki's own logout is then the whole of it.
   */
  async logoutUrl(): Promise<string | null> {
    const url = String(this.conf.logoutURL || '').trim()
    if (!url) {
      return null
    }
    if (!URL.canParse(url) || !['https:', 'http:'].includes(new URL(url).protocol)) {
      strategyDebug(this, `Logout URL is not an http(s) URL: ${url}`)
      return null
    }
    return url
  }
}
