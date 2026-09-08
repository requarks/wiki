import * as client from 'openid-client'
import { describeAuthError, missingSettings, strategyDebug } from '../../../helpers/authDebug.ts'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/** Google's issuer, from which every endpoint and signing key is discovered. */
const ISSUER = 'https://accounts.google.com'

/**
 * Where a Workspace account's groups are read from, and what it takes to read them.
 *
 * Not an OpenID Connect thing at all: Google's ID token carries no groups claim and never has, so
 * the only way to learn them is to spend the access token on the Cloud Identity API. `groups/-` is
 * the whole directory rather than one group — the search is by member, across everything.
 */
const GROUPS_URL = 'https://cloudidentity.googleapis.com/v1/groups/-/memberships:searchDirectGroups'
const GROUPS_SCOPE = 'https://www.googleapis.com/auth/cloud-identity.groups.readonly'

/**
 * The label that distinguishes a Google Group from the other things Cloud Identity calls a group —
 * security groups, dynamic groups, the identity-mapped groups other providers put there. The query
 * language requires a label, so this is not a filter that could be left off.
 */
const DISCUSSION_FORUM_LABEL = 'cloudidentity.googleapis.com/groups.discussion_forum'

/** How many pages of five hundred groups are read before the answer is treated as unusable. */
const MAX_GROUP_PAGES = 10

/**
 * Google
 *
 * Google is an OpenID Connect provider, so this is the generic flow with the issuer fixed and three
 * things Google specifically needs saying about:
 *
 *   - a Workspace domain can be required, and the claim is checked HERE as well as asked for — `hd`
 *     on the authorization request is a hint to the account chooser, not a promise about the answer;
 *   - `email_verified` is honoured, because an account on this wiki is matched by email address and
 *     an unverified one says nothing about who holds the mailbox;
 *   - groups are a Workspace notion and are nowhere in the token, so mapping them is a call to a
 *     second API with a scope of its own. See `groupsFor`.
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
      strategyDebug(
        this,
        `is not configured: ${missingSettings({ 'Client ID': this.conf.clientId, 'Client Secret': this.conf.clientSecret })}`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    try {
      this.config = await client.discovery(
        new URL(ISSUER),
        this.conf.clientId,
        this.conf.clientSecret
      )
    } catch (err: any) {
      // -> Google's own metadata, so this is the wiki's outbound connectivity rather than a setting
      strategyDebug(
        this,
        `could not read Google's metadata from ${ISSUER}: ${describeAuthError(err)}`
      )
      throw err
    }
    return this.config
  }

  /**
   * One page of the Cloud Identity group search, as the person signing in.
   *
   * @throws `ERR_PROVIDER_REQUEST_FAILED` when the page could not be read. A 403 is the usual one and
   *         means the account may not see its own memberships — the Cloud Identity API not enabled on
   *         the project, or a Workspace whose group visibility is closed down — rather than that
   *         there are none, which is why it is not quietly read as an empty list
   */
  private async groupPage(query: string, accessToken: string, pageToken?: string): Promise<any> {
    const url = new URL(GROUPS_URL)
    url.searchParams.set('query', query)
    url.searchParams.set('pageSize', '500')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }
    let resp: Response
    strategyDebug(this, `asking the Cloud Identity API for group memberships: ${query}`)
    try {
      resp = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
      })
    } catch (err: any) {
      WIKI.logger.warn(
        `Google strategy ${this.strategyId} could not reach the Cloud Identity API: ${err.message}`
      )
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
    if (!resp.ok) {
      WIKI.logger.warn(
        `Google strategy ${this.strategyId} asked the Cloud Identity API for group memberships and it answered ${resp.status}.`
      )
      // -> The body as well as the status, under the flag: Google's error payload names the API that
      //    is not enabled or the permission that is missing, which the status alone does not
      strategyDebug(
        this,
        `the Cloud Identity API answered ${resp.status}: ${await resp.text().catch(() => '(no body)')}`
      )
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
    return resp.json()
  }

  /**
   * The wiki group names this person's Workspace groups stand for.
   *
   * **An account with no `hd` claim is in no Workspace, and therefore in no groups.** That is a known
   * answer rather than a failed one — a personal Google account has nothing for Cloud Identity to
   * search — so it is an empty list, and under `unassignMissingGroups` it correctly takes away
   * memberships that nothing backs. Every other way of not getting an answer raises instead, since a
   * lookup that failed must not be read as a person belonging to nothing.
   *
   * **Direct memberships only.** `searchDirectGroups` is what a member may run about themselves;
   * `searchTransitiveGroups` would follow nesting but is limited to the Enterprise and Cloud Identity
   * Premium tiers, so a group that contains another group has to be named here in its own right.
   */
  private async groupsFor(
    email: string,
    hostedDomain: unknown,
    accessToken: string
  ): Promise<string[]> {
    if (!hostedDomain) {
      strategyDebug(
        this,
        `<${email}> is in no Workspace (no \`hd\` claim), so it is in no groups either`
      )
      return []
    }
    /*
      The address goes into a CEL string literal, so the two characters that could end it early are
      escaped. Neither occurs in an address Google issued, which is what this one is — the escaping
      is here so that stays a fact about Google rather than an assumption this code rests on.
    */
    const member = email.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
    const query = `member_key_id == '${member}' && '${DISCUSSION_FORUM_LABEL}' in labels`
    const byName = this.conf.groupIdentifier === 'name'
    const names: string[] = []
    let pageToken: string | undefined
    for (let page = 1; page <= MAX_GROUP_PAGES; page++) {
      const body = await this.groupPage(query, accessToken, pageToken)
      for (const membership of body?.memberships ?? []) {
        const value = byName ? membership?.displayName : membership?.groupKey?.id
        if (typeof value === 'string' && value.trim().length > 0) {
          names.push(value.trim())
        }
      }
      pageToken = body?.nextPageToken
      if (!pageToken) {
        strategyDebug(
          this,
          `the Cloud Identity API names ${names.length} group(s) for <${email}>, read by ${byName ? 'display name' : 'group key'}: ${names.join(', ') || 'none'}`
        )
        return names
      }
    }
    /*
      Not treated as the end of the list but as a failure to read it: a truncated list under
      `unassignMissingGroups` is a list that takes memberships away.
    */
    WIKI.logger.warn(
      `Google strategy ${this.strategyId} stopped reading group memberships after ${MAX_GROUP_PAGES} pages, so the list is incomplete.`
    )
    throw new Error('ERR_PROVIDER_REQUEST_FAILED')
  }

  async authorizationUrl({ redirectUri, state, nonce, codeVerifier }: AuthFlow): Promise<string> {
    const config = await this.configuration()
    return client
      .buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        /*
          The groups scope is only asked for when groups are being mapped: it is one Google
          classifies as sensitive, so an app that requests it has to be verified before anybody
          outside its own organization can consent to it — which a wiki mapping its own Workspace's
          groups does not hit, its OAuth app being internal to that organization.
        */
        scope:
          this.conf.mapGroups === true
            ? `openid profile email ${GROUPS_SCOPE}`
            : 'openid profile email',
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
    let tokens
    try {
      tokens = await client.authorizationCodeGrant(config, new URL(currentUrl), {
        expectedState: state,
        expectedNonce: nonce,
        pkceCodeVerifier: codeVerifier
      })
    } catch (err: any) {
      strategyDebug(this, `Google's answer did not check out: ${describeAuthError(err)}`)
      throw err
    }
    const claims = tokens.claims() as Record<string, any> | undefined
    if (!claims?.sub) {
      strategyDebug(
        this,
        'Google returned no ID token, so there is nothing signed saying who signed in'
      )
      throw new Error('ERR_NO_ID_TOKEN')
    }

    const email = claims.email
    if (!email || typeof email !== 'string') {
      strategyDebug(
        this,
        `the ID token carries no email claim. It carries: ${Object.keys(claims).join(', ')}`
      )
      throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
    }
    if (claims.email_verified === false && this.conf.allowUnverifiedEmail !== true) {
      strategyDebug(
        this,
        `Google has not verified <${email}>, and this strategy does not allow unverified addresses`
      )
      throw new Error('ERR_EMAIL_NOT_VERIFIED')
    }
    if (this.conf.hostedDomain && claims.hd !== this.conf.hostedDomain) {
      // -> Which domain it IS is the whole of the diagnosis: a personal account has no `hd` at all,
      //    and a Workspace account has the one it is in, misspelled setting or not
      strategyDebug(
        this,
        `<${email}> is in ${claims.hd ? `the \`${claims.hd}\` Workspace` : 'no Workspace'}, and this strategy is restricted to \`${this.conf.hostedDomain}\``
      )
      throw new Error('ERR_ACCOUNT_NOT_ALLOWED')
    }
    const groups =
      this.conf.mapGroups === true
        ? await this.groupsFor(email, claims.hd, tokens.access_token)
        : undefined
    strategyDebug(
      this,
      `${claims.sub} signs in as <${email}>${groups ? `, in ${groups.length} Workspace group(s)` : ', groups not mapped'}`
    )

    return {
      id: claims.sub,
      email,
      name: (claims.name as string) || email,
      ...(groups
        ? {
            groups,
            groupsExclusive: this.conf.unassignMissingGroups === true
          }
        : {})
    }
  }
}
