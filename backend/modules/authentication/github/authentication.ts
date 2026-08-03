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

  /** A GitHub API call as this user, with the headers GitHub asks every client to send. */
  private async api(path: string, accessToken: string): Promise<any> {
    const resp = await fetch(`${this.hosts.api}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Wiki.js'
      }
    })
    if (!resp.ok) {
      throw new Error(`ERR_PROVIDER_REQUEST_FAILED`)
    }
    return resp.json()
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
    const tokenResp = await fetch(`${this.hosts.web}/login/oauth/access_token`, {
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
    const token = (await tokenResp.json()) as Record<string, any>
    // -> GitHub reports a refused exchange as 200 with an `error` field, not as a status
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
      const resp = await fetch(
        `${this.hosts.api}/orgs/${encodeURIComponent(org)}/members/${encodeURIComponent(account.login)}`,
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Wiki.js'
          }
        }
      )
      // -> 204 is a member, 302 is "ask as somebody who can see", 404 is not a member
      if (resp.status !== 204) {
        throw new Error('ERR_LOGIN_RESTRICTED')
      }
    }

    return {
      id: String(account.id),
      email,
      name: account.name || account.login
    }
  }
}
