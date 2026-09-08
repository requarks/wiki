import { missingSettings, strategyDebug } from '../../../helpers/authDebug.ts'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/** How many pages of a hundred teams are read before the answer is treated as unusable. */
const MAX_TEAM_PAGES = 10

/**
 * GitHub
 *
 * GitHub speaks OAuth 2.0 and not OpenID Connect: there is no ID token, and therefore nothing to
 * verify signatures on — the access token is exchanged over TLS and then spent against the API, which
 * answers who it belongs to. That is the whole protocol here, so this module is written with `fetch`
 * and no dependency. The parts a library would otherwise be trusted with — `state`, and keeping the
 * client secret off the browser — are done by the flow around it (`api/authentication.ts`).
 *
 * Three GitHub-specific things are worth the code:
 *
 *   - the address comes from `/user/emails` rather than `/user`, because a profile's public email is
 *     often empty and always unverified. Only a verified primary address is accepted;
 *   - an organization can be required, checked against the membership API with the user's own token;
 *   - the teams within that organization can be mapped onto wiki groups, which is why the mapping is
 *     only offered alongside the restriction — a team is a thing inside one organization.
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

  /**
   * The strategy's settings, refused if they cannot describe a login.
   *
   * Mapping groups without an organization is the one combination worth failing over rather than
   * working around: a team belongs to an organization, so there would be no teams to read — and
   * answering with an empty group list is not the same as answering with nothing. Under
   * `unassignMissingGroups` it is a statement that this person is on no team, which would take every
   * mapped membership away from everybody who logged in. A misconfiguration must not quietly empty
   * the groups it was meant to fill.
   *
   * @throws `ERR_STRATEGY_MISCONFIGURED`
   */
  private settings(): { clientId: string; clientSecret: string; organization: string } {
    const clientId = (this.conf.clientId || '').trim()
    const clientSecret = this.conf.clientSecret || ''
    const organization = (this.conf.allowedOrganization || '').trim()
    if (!clientId || !clientSecret) {
      strategyDebug(
        this,
        `is not configured: ${missingSettings({ 'Client ID': clientId, 'Client Secret': clientSecret })}`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    if (this.conf.mapGroups === true && !organization) {
      WIKI.logger.warn(
        `GitHub strategy ${this.strategyId} maps groups but is not restricted to an organization, and a team belongs to one.`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    return { clientId, clientSecret, organization }
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
      // -> The body as well as the status: GitHub's error payload names the scope that was not
      //    granted or the resource that is not visible, which the status alone does not
      strategyDebug(
        this,
        `GET ${path} answered ${resp.status}: ${await resp.text().catch(() => '(no body)')}`
      )
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
      strategyDebug(this, `${login} is a member of ${org}`)
      return true
    }
    if (resp.status === 404) {
      strategyDebug(
        this,
        `${login} is not a member of ${org} as far as this token can see — a private membership needs the OAuth app approved by the organization`
      )
      return false
    }
    WIKI.logger.warn(
      `GitHub strategy ${this.strategyId} could not check membership of ${org} for ${login}: the API answered ${resp.status}.`
    )
    throw new Error('ERR_PROVIDER_REQUEST_FAILED')
  }

  /**
   * The teams this account is on within the organization the strategy requires, by name.
   *
   * `/user/teams` is the only listing a person's own token can spend: it answers with every team
   * they are on across every organization they belong to, so the answer is filtered down to the one
   * organization this strategy is about — a team called `admins` in somebody else's organization is
   * not a claim on a group here.
   *
   * **The team's name, not its slug.** They differ as soon as a name has a space or a capital in it
   * (`Core Developers` against `core-developers`), and the name is the one an administrator reads
   * off GitHub's own screens. Matching is case-insensitive, in `models/users.ts`.
   *
   * A page short of a hundred is the last one; a run past `MAX_TEAM_PAGES` is not treated as the end
   * of the list but as a failure to read it, because a truncated list under `unassignMissingGroups`
   * is a list that takes memberships away.
   *
   * @throws `ERR_PROVIDER_REQUEST_FAILED` when the teams could not be read
   */
  private async teamsIn(org: string, accessToken: string): Promise<string[]> {
    const wanted = org.toLowerCase()
    const names: string[] = []
    for (let page = 1; page <= MAX_TEAM_PAGES; page++) {
      const batch = await this.api(`/user/teams?per_page=100&page=${page}`, accessToken)
      if (!Array.isArray(batch)) {
        throw new Error('ERR_PROVIDER_REQUEST_FAILED')
      }
      for (const team of batch) {
        if (
          typeof team?.name === 'string' &&
          team.name.trim().length > 0 &&
          typeof team.organization?.login === 'string' &&
          team.organization.login.toLowerCase() === wanted
        ) {
          names.push(team.name.trim())
        }
      }
      if (batch.length < 100) {
        strategyDebug(this, `${names.length} team(s) in ${org}: ${names.join(', ') || 'none'}`)
        return names
      }
    }
    WIKI.logger.warn(
      `GitHub strategy ${this.strategyId} stopped reading teams after ${MAX_TEAM_PAGES} pages, so the list is incomplete.`
    )
    throw new Error('ERR_PROVIDER_REQUEST_FAILED')
  }

  async authorizationUrl({ redirectUri, state }: AuthFlow): Promise<string> {
    const { clientId, organization } = this.settings()
    const url = new URL(`${this.hosts.web}/login/oauth/authorize`)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    /*
      `user:email` is what makes the verified addresses readable; `read:org` is only asked for when an
      organization is being enforced, since a scope nobody needs is a scope nobody should be granting.
      It covers the teams as well as the membership, so mapping groups asks for nothing further.
    */
    url.searchParams.set(
      'scope',
      organization ? 'read:user user:email read:org' : 'read:user user:email'
    )
    url.searchParams.set('state', state)
    return url.toString()
  }

  async profile({ code, redirectUri }: AuthFlowCallback): Promise<ProviderProfile> {
    const { clientId, clientSecret, organization } = this.settings()
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
        client_id: clientId,
        client_secret: clientSecret,
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
      strategyDebug(
        this,
        `the token exchange answered ${tokenResp.status} with something that is not JSON — is something else answering for ${this.hosts.web}?`
      )
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }
    if (!tokenResp.ok || token.error || !token.access_token) {
      // -> GitHub's own account of the refusal, which names the cause: `bad_verification_code` for a
      //    code already spent, `incorrect_client_credentials` for a Client Secret that has been reset
      strategyDebug(
        this,
        `the token exchange answered ${tokenResp.status}: ${[token.error, token.error_description].filter(Boolean).join(': ') || 'no access token'}`
      )
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }

    const account = await this.api('/user', token.access_token)
    if (!account?.id) {
      strategyDebug(this, 'the API answered with no account for this token')
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }

    /*
      The primary verified address, which is the only one that says anything: `account.email` is
      whatever the profile shows publicly, is frequently null, and is never checked by GitHub.
    */
    const emails: any[] = await this.api('/user/emails', token.access_token)
    const email = emails?.find((entry) => entry.primary && entry.verified)?.email
    if (!email) {
      // -> Counts rather than the addresses themselves, which are not needed to tell the two cases
      //    apart: no addresses at all is the `user:email` scope missing, and addresses with no
      //    verified primary among them is an account that has to confirm one at GitHub first
      strategyDebug(
        this,
        `${account.login} has no verified primary address (${emails?.length ?? 0} address(es) readable, ${emails?.filter((entry) => entry.verified).length ?? 0} verified)`
      )
      throw new Error('ERR_NO_VERIFIED_EMAIL_FROM_PROVIDER')
    }

    if (organization) {
      if (!(await this.isOrgMember(organization, account.login, token.access_token))) {
        throw new Error('ERR_ACCOUNT_NOT_ALLOWED')
      }
    }

    const groups =
      this.conf.mapGroups === true
        ? await this.teamsIn(organization, token.access_token)
        : undefined
    strategyDebug(
      this,
      `${account.login} (${account.id}) signs in as <${email}>${groups ? `, on ${groups.length} team(s)` : ', groups not mapped'}`
    )

    return {
      id: String(account.id),
      email,
      name: account.name || account.login,
      ...(groups
        ? {
            groups,
            groupsExclusive: this.conf.unassignMissingGroups === true
          }
        : {})
    }
  }
}
