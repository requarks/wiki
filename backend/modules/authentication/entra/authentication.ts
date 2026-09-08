import * as client from 'openid-client'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/** Where a tenant's OpenID Connect metadata lives. `{tenant}` is the one thing configurable about it. */
const ISSUER_TEMPLATE = 'https://login.microsoftonline.com/{tenant}/v2.0'

/**
 * The tenant placeholders Entra accepts and this module does not.
 *
 * They are what makes an app registration multi-tenant, and a multi-tenant login is a different
 * thing from the one being offered here: the ID token would then be accepted from ANY Entra
 * directory, so anybody with a Microsoft account anywhere could present a valid token for this
 * wiki. Restricting that means checking the issuer against a list of tenants the wiki accepts, which
 * is a feature and not a default. Discovery would not carry it off either — the metadata for these
 * answers with a literal `{tenantid}` in the `issuer` field, which no token ever matches.
 */
const MULTI_TENANT = ['common', 'organizations', 'consumers']

/**
 * Microsoft Entra ID (formerly Azure Active Directory)
 *
 * Entra is an OpenID Connect provider, so this is the generic flow with the issuer built from the
 * tenant. What is worth saying about Entra specifically is what its tokens carry, because that is
 * where a working configuration is usually lost:
 *
 *   - the email address is in `email` only if the account has a Mail attribute or the tenant maps the
 *     optional claim, and is in `preferred_username` otherwise, so which claim to read is a setting;
 *   - the groups claim carries object IDs rather than names unless the tenant is synced from Active
 *     Directory, which is a thing about the directory and not about this module;
 *   - there is no picture claim at all, so an avatar arrives only from a tenant that maps one.
 *
 * Written against `openid-client` for the reason the generic module is: the ID token has to be
 * verified against the tenant's published keys, and a token nobody verified still logs somebody in.
 */
export default class EntraAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  /** The tenant as `openid-client` sees it. One discovery round trip, kept for every login after. */
  private config: client.Configuration | null = null

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  private async configuration(): Promise<client.Configuration> {
    if (this.config) {
      return this.config
    }
    const { tenantId, clientId, clientSecret } = this.conf
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    if (MULTI_TENANT.includes(String(tenantId).toLowerCase())) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    this.config = await client.discovery(
      new URL(ISSUER_TEMPLATE.replace('{tenant}', encodeURIComponent(tenantId))),
      clientId,
      clientSecret
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
        code_challenge_method: 'S256'
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
    const claims = tokens.claims()
    if (!claims?.sub) {
      throw new Error('ERR_NO_ID_TOKEN')
    }

    /*
      The userinfo endpoint is asked as well as the token read, because a tenant that emits the group
      claim only "as a distributed claim" — which is what a token past 200 groups gets — keeps it
      behind there. `fetchUserInfo` checks the answer is about the same subject.
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
      // -> `oid` is the account's identifier within the tenant and `sub` is its identifier for this
      //    one application. `sub` is the one to link by: it is what the ID token was verified as
      //    being about, and it is stable for as long as the app registration is
      id: claims.sub,
      email,
      name: (info[this.conf.displayNameClaim || 'name'] as string) || email,
      picture: this.pictureFrom(info),
      ...(this.conf.mapGroups === true
        ? {
            groups: this.groupsFrom(info),
            groupsExclusive: this.conf.unassignMissingGroups === true
          }
        : {})
    }
  }

  /**
   * The URL of the account's picture, for a tenant that maps a claim carrying one.
   *
   * Empty by default, and an empty claim name turns it off — Entra emits nothing of the sort on its
   * own, and a person's photo in Entra is behind Microsoft Graph rather than in a token.
   */
  private pictureFrom(info: Record<string, any>): string | undefined {
    const claim = this.conf.pictureClaim
    if (!claim) {
      return undefined
    }
    const value = info[claim]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  /** The group names — or, as Entra usually has it, the group object IDs — the claim carries. */
  private groupsFrom(info: Record<string, any>): string[] {
    const value = info[this.conf.groupsClaim || 'groups']
    const raw = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
    return raw
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
  }
}
