import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/**
 * GitHub
 *
 * GitHub speaks OAuth 2.0 and not OpenID Connect: there is no ID token, and therefore nothing to
 * verify signatures on — the access token is exchanged over TLS and then spent against the API, which
 * answers who it belongs to. That is the whole protocol here, so this module is written with `fetch`
 * and no dependency. The parts a library would otherwise be trusted with — `state`, and keeping the
 * client secret off the browser — are done by the flow around it (`api/authentication.ts`).
 *
 * Two GitHub-specific things are worth the code:
 *
 *   - the address comes from `/user/emails` rather than `/user`, because a profile's public email is
 *     often empty and always unverified. Only a verified primary address is accepted;
 *   - an organization can be required, checked against the membership API with the user's own token.
 */
export default class GitHubAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  /** Where a user signs in, and where the API lives — the two differ on Enterprise Server. */
  private get hosts(): { web: string; api: string } {
    const enterprise = (this.conf.enterpriseHost || '').trim().replace(/^https?:\/\//, '')
    return enterprise
      ? { web: `https://${enterprise}`, api: `https://${enterprise}/api/v3` }
      : { web: 'https://github.com', api: 'https://api.github.com' }
  }

  /** The headers GitHub asks every client to send, as this user. */
  private apiHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Wiki.js'
    }
  }

  /**
   * `fetch`, with an unreachable GitHub reported as a provider failure rather than as itself.
   *
   * A rejected fetch carries a message about sockets and DNS, and the callback route puts whatever it
   * caught into the URL it redirects to — so left alone, "fetch failed" is what the person trying to
   * log in reads. Every call this module makes goes through here for that reason.
   */
  private async reach(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init)
    } catch (err: any) {
      WIKI.logger.warn(`GitHub strategy ${this.strategyId} could not reach ${url}: ${err.message}`)
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
  }

  /** A GitHub API call as this user. */
  private async api(path: string, accessToken: string): Promise<any> {
    const resp = await this.reach(`${this.hosts.api}${path}`, {
      headers: this.apiHeaders(accessToken)
    })
    if (!resp.ok) {
      throw new Error(`ERR_PROVIDER_REQUEST_FAILED`)
    }
    return resp.json()
  }

  /**
   * Whether this account is a member of the organization the strategy requires.
   *
   * `GET /orgs/{org}/members/{username}` answers from the point of view of whoever is asking, and the
   * token asking here belongs to the person signing in — so a member checking themselves gets 204. A
   * non-member gets a 302 to `/orgs/{org}/public_members/{username}`, which `fetch` follows on its
   * own (same origin, so the Authorization header survives it). The consequence worth knowing: the
   * question quietly becomes "is a PUBLIC member" whenever the token cannot see private membership —
   * an organization with OAuth app access restrictions that has not approved this app — which is why
   * the setting's hint asks for either a public membership or an approved app.
   *
   * **Only 404 is a refusal.** Every other answer is a failure to find out: a token revoked between
   * the exchange and here, an abuse-detection 403, GitHub being down. Reporting those as "you are not
   * a member of this organization" sends a legitimate member away with an answer that is wrong,
   * unactionable, and indistinguishable in the log from a genuine refusal.
   *
   * @throws `ERR_PROVIDER_REQUEST_FAILED` when membership could not be determined
   */
  private async isOrgMember(org: string, login: string, accessToken: string): Promise<boolean> {
    const path = `/orgs/${encodeURIComponent(org)}/members/${encodeURIComponent(login)}`
    const resp = await this.reach(`${this.hosts.api}${path}`, {
      headers: this.apiHeaders(accessToken)
    })
    if (resp.status === 204) {
      return true
    }
    if (resp.status === 404) {
      return false
    }
    WIKI.logger.warn(
      `GitHub strategy ${this.strategyId} could not check membership of ${org} for ${login}: the API answered ${resp.status}.`
    )
    throw new Error('ERR_PROVIDER_REQUEST_FAILED')
  }

  async authorizationUrl({ redirectUri, state }: AuthFlow): Promise<string> {
    if (!this.conf.clientId || !this.conf.clientSecret) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    const url = new URL(`${this.hosts.web}/login/oauth/authorize`)
    url.searchParams.set('client_id', this.conf.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    /*
      `user:email` is what makes the verified addresses readable; `read:org` is only asked for when an
      organization is being enforced, since a scope nobody needs is a scope nobody should be granting.
    */
    url.searchParams.set(
      'scope',
      this.conf.allowedOrganization ? 'read:user user:email read:org' : 'read:user user:email'
    )
    url.searchParams.set('state', state)
    return url.toString()
  }

  async profile({ code, redirectUri }: AuthFlowCallback): Promise<ProviderProfile> {
    if (!code) {
      throw new Error('ERR_NO_AUTHORIZATION_CODE')
    }
    // -> `Accept: application/json`, or GitHub answers this one in form encoding
    const tokenResp = await this.reach(`${this.hosts.web}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Wiki.js'
      },
      body: JSON.stringify({
        client_id: this.conf.clientId,
        client_secret: this.conf.clientSecret,
        redirect_uri: redirectUri,
        code
      })
    })
    /*
      GitHub reports a refused exchange as 200 with an `error` field rather than as a status, so the
      body has to be read either way — and a body that is not JSON at all is something else answering
      on GitHub's behalf, a proxy or a captive portal, which is a failed exchange and not a parse
      error to hand to the person logging in.
    */
    let token: Record<string, any>
    try {
      token = (await tokenResp.json()) as Record<string, any>
    } catch {
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }
    if (!tokenResp.ok || token.error || !token.access_token) {
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }

    const account = await this.api('/user', token.access_token)
    if (!account?.id) {
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }

    /*
      The primary verified address, which is the only one that says anything: `account.email` is
      whatever the profile shows publicly, is frequently null, and is never checked by GitHub.
    */
    const emails: any[] = await this.api('/user/emails', token.access_token)
    const email = emails?.find((entry) => entry.primary && entry.verified)?.email
    if (!email) {
      throw new Error('ERR_NO_VERIFIED_EMAIL_FROM_PROVIDER')
    }

    if (this.conf.allowedOrganization) {
      const org = this.conf.allowedOrganization.trim()
      if (!(await this.isOrgMember(org, account.login, token.access_token))) {
        throw new Error('ERR_ACCOUNT_NOT_ALLOWED')
      }
    }

    return {
      id: String(account.id),
      email,
      name: account.name || account.login
    }
  }
}
