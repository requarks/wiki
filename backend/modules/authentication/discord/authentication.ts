import { missingSettings, strategyDebug } from '../../../helpers/authDebug.ts'
import type { AuthFlow, AuthFlowCallback, ProviderProfile } from '../../../models/authentication.ts'

/** Where a person signs in. Not under `/api`, unlike everything else Discord answers. */
const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize'

/** The pinned API version. Discord dates its breaking changes to these and leaves old ones running. */
const API = 'https://discord.com/api/v10'

/**
 * How long a server's role list is kept before being read again.
 *
 * Roles are renamed rarely and logins are frequent, so this is a cache with a clock rather than an
 * invalidation. A role that is *new* does not wait it out: an ID the cache cannot name is what
 * `roleNames` treats as proof the list is stale, and it reads it again there and then.
 */
const ROLE_CACHE_MS = 5 * 60 * 1000

/**
 * Discord
 *
 * Discord speaks OAuth 2.0 and not OpenID Connect: there is no ID token and so nothing to verify a
 * signature on — the access token is exchanged over TLS and then spent against the API, which
 * answers who it belongs to. That is the whole protocol, so this module is written with `fetch` and
 * no dependency, like the GitHub one. `state` and keeping the client secret off the browser are the
 * flow's job (`api/authentication.ts`).
 *
 * Three things about Discord specifically are worth the code:
 *
 *   - **an account's email is only worth anything when `verified` is set.** Discord will hand over
 *     an address that has never been confirmed, and an account here is matched by address;
 *   - **a server can be required**, which is one call — `/users/@me/guilds/{id}/member` answers 404
 *     for somebody who is not in it, and answers with their roles for somebody who is. So the
 *     restriction and the group mapping are the same request;
 *   - **roles arrive as IDs, never as names.** Nothing a user's own token can be spent on will name
 *     a role; only a bot in the server can read the list. Hence the optional bot token, and hence
 *     what the mapping falls back to without one — see `roleNames`.
 */
export default class DiscordAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  /** The server's roles by ID, as of `expires`. Only ever populated when a bot token is configured. */
  private roles: { names: Map<string, string>; expires: number } | null = null

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  /**
   * The strategy's settings, refused if they cannot describe a login.
   *
   * Mapping groups without a server is the one combination worth failing over rather than working
   * around: roles belong to a server, so there would be no roles to read — and answering with an
   * empty group list is not the same as answering with nothing. Under `unassignMissingGroups` it is
   * a statement that this person holds no roles, which would take every mapped membership away from
   * everybody who logged in. A misconfiguration must not quietly empty the groups it was meant to
   * fill.
   *
   * @throws `ERR_STRATEGY_MISCONFIGURED`
   */
  private settings(): { clientId: string; clientSecret: string; serverId: string } {
    const clientId = (this.conf.clientId || '').trim()
    const clientSecret = this.conf.clientSecret || ''
    const serverId = (this.conf.serverId || '').trim()
    if (!clientId || !clientSecret) {
      strategyDebug(
        this,
        `is not configured: ${missingSettings({ 'Client ID': clientId, 'Client Secret': clientSecret })}`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    if (this.conf.mapGroups === true && !serverId) {
      WIKI.logger.warn(
        `Discord strategy ${this.strategyId} maps groups but has no Server ID, and a role belongs to a server.`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    return { clientId, clientSecret, serverId }
  }

  /**
   * `fetch`, with an unreachable Discord reported as a provider failure rather than as itself.
   *
   * A rejected fetch carries a message about sockets and DNS, and the callback route puts whatever it
   * caught into the URL it redirects to — so left alone, "fetch failed" is what the person trying to
   * log in reads. Every call this module makes goes through here for that reason.
   */
  private async reach(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init)
    } catch (err: any) {
      WIKI.logger.warn(`Discord strategy ${this.strategyId} could not reach ${url}: ${err.message}`)
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
  }

  /**
   * A Discord API call, as whoever the authorization says — a person's access token, or the bot.
   *
   * @returns The parsed body, or null on 404, which is the one status this API uses to mean "no such
   *          thing" rather than "something went wrong"
   * @throws `ERR_PROVIDER_REQUEST_FAILED` on any other unsuccessful answer
   */
  private async api(path: string, authorization: string): Promise<any | null> {
    const resp = await this.reach(`${API}${path}`, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        'User-Agent': 'Wiki.js'
      }
    })
    if (resp.status === 404) {
      return null
    }
    if (!resp.ok) {
      WIKI.logger.warn(
        `Discord strategy ${this.strategyId} asked for ${path} and the API answered ${resp.status}.`
      )
      // -> The body as well as the status, under the flag: Discord's error payload names the scope
      //    that was not granted or the intent the bot is missing, which the status alone does not
      strategyDebug(
        this,
        `GET ${path} answered ${resp.status}: ${await resp.text().catch(() => '(no body)')}`
      )
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
    return resp.json()
  }

  /**
   * The server's roles by ID, read with the bot token.
   *
   * **Without a bot token this is empty and the mapping is by role ID**, because nothing else is
   * available: `/users/@me/guilds/{id}/member` names the roles a person holds as snowflakes and no
   * endpoint a user token can reach turns those into names. A wiki group then has to be named as the
   * ID, which the setting's hint says.
   *
   * With one, names are the mapping and a failure to read them fails the login. Falling back to IDs
   * there would silently change what every group name matches — under `unassignMissingGroups`, into
   * taking every mapped membership away — so a bot token that has stopped working is an error to
   * raise and not a case to carry on through.
   *
   * @param refresh Read the list again even if the cached one has not expired. Passed for a role ID
   *                the cache cannot name, which is what a role created since it was filled looks
   *                like.
   */
  private async roleNames(serverId: string, refresh = false): Promise<Map<string, string>> {
    const botToken = this.conf.botToken || ''
    if (!botToken) {
      return new Map()
    }
    if (!refresh && this.roles && this.roles.expires > Date.now()) {
      return this.roles.names
    }
    const roles = await this.api(`/guilds/${encodeURIComponent(serverId)}/roles`, `Bot ${botToken}`)
    if (!Array.isArray(roles)) {
      // -> 404: no such server, or a bot that is not in it. Either way the names are not readable
      WIKI.logger.warn(
        `Discord strategy ${this.strategyId} could not read the roles of server ${serverId} — is the bot a member of it?`
      )
      throw new Error('ERR_PROVIDER_REQUEST_FAILED')
    }
    const names = new Map<string, string>(
      roles
        .filter((role: any) => typeof role?.id === 'string' && typeof role?.name === 'string')
        .map((role: any) => [role.id as string, (role.name as string).trim()])
    )
    this.roles = { names, expires: Date.now() + ROLE_CACHE_MS }
    return names
  }

  /**
   * The wiki group names this person's roles on the server stand for.
   *
   * `@everyone` is not among them: it is a role every member holds and Discord leaves it out of a
   * member's list, which is the answer that wants — a group everybody is in is not a mapping.
   */
  private async groupsFor(serverId: string, roleIds: string[]): Promise<string[]> {
    let names = await this.roleNames(serverId)
    if (names.size < 1) {
      // -> No bot token. The IDs are the whole of what Discord will say about these roles
      strategyDebug(
        this,
        `no Bot Token is configured, so the ${roleIds.length} role(s) held can only be matched by ID: ${roleIds.join(', ') || 'none'}`
      )
      return roleIds
    }
    if (roleIds.some((id) => !names.has(id))) {
      names = await this.roleNames(serverId, true)
    }
    /*
      A role still unknown after re-reading is one deleted between the two calls — it is not a role
      any more, so it names no group. Dropped rather than passed on as its ID, which would only be a
      group name by coincidence.
    */
    return roleIds.map((id) => names.get(id)).filter((name): name is string => Boolean(name))
  }

  /** The CDN URL of the account's picture, for an account that has set one. */
  private pictureFor(account: Record<string, any>): string | undefined {
    if (typeof account.avatar !== 'string' || !account.avatar) {
      return undefined
    }
    // -> An `a_` hash is an animated avatar, which is a GIF and 404s as anything else
    const ext = account.avatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.${ext}?size=256`
  }

  async authorizationUrl({ redirectUri, state }: AuthFlow): Promise<string> {
    const { clientId, serverId } = this.settings()
    const url = new URL(AUTHORIZE_URL)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', redirectUri)
    /*
      `identify email` is the address and the account; `guilds.members.read` is only asked for when a
      server is being enforced, since a scope nobody needs is a scope nobody should be granting. Note
      it is not `guilds`, which lists every server the person is in — this one reads their membership
      of the servers this application is allowed to ask about, and nothing else.
    */
    url.searchParams.set(
      'scope',
      serverId ? 'identify email guilds.members.read' : 'identify email'
    )
    url.searchParams.set('state', state)
    // -> Skips the authorization screen for somebody who has already granted exactly these scopes.
    //    Discord shows it anyway when they have not, so this is a returning user's convenience
    url.searchParams.set('prompt', 'none')
    return url.toString()
  }

  async profile({ code, redirectUri }: AuthFlowCallback): Promise<ProviderProfile> {
    const { clientId, clientSecret, serverId } = this.settings()
    if (!code) {
      throw new Error('ERR_NO_AUTHORIZATION_CODE')
    }

    // -> Form encoding, which is the only thing this endpoint accepts — JSON is a 400
    const tokenResp = await this.reach(`${API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'Wiki.js'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code
      }).toString()
    })
    /*
      A body that is not JSON at all is something else answering on Discord's behalf — a proxy or a
      captive portal — which is a failed exchange and not a parse error to hand to whoever is trying
      to log in.
    */
    let token: Record<string, any>
    try {
      token = (await tokenResp.json()) as Record<string, any>
    } catch {
      strategyDebug(
        this,
        `the token exchange answered ${tokenResp.status} with something that is not JSON — is something else answering for ${API}?`
      )
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }
    if (!tokenResp.ok || token.error || !token.access_token) {
      // -> Discord's own account of the refusal, which names the cause: `invalid_client` for a Client
      //    Secret that has been reset, `invalid_grant` for a Redirect URI it does not have registered
      strategyDebug(
        this,
        `the token exchange answered ${tokenResp.status}: ${[token.error, token.error_description].filter(Boolean).join(': ') || 'no access token'}`
      )
      throw new Error('ERR_TOKEN_EXCHANGE_FAILED')
    }
    const bearer = `Bearer ${token.access_token}`

    const account = await this.api('/users/@me', bearer)
    if (!account?.id) {
      strategyDebug(this, 'the API answered with no account for this token')
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }
    /*
      `verified` is Discord's own statement that the address has been confirmed. An unverified one
      says nothing about who holds the mailbox, and the mailbox is what an account here is matched
      by, so it is refused rather than trusted.
    */
    if (!account.email || account.verified !== true) {
      strategyDebug(
        this,
        `${account.username} ${account.email ? 'has not confirmed their address with Discord' : 'gave no address — was the `email` scope granted?'}`
      )
      throw new Error('ERR_NO_VERIFIED_EMAIL_FROM_PROVIDER')
    }

    let roleIds: string[] = []
    if (serverId) {
      /*
        404 here is either "not a member" or "no such server", and Discord does not distinguish the
        two — so a mistyped Server ID looks exactly like nobody being allowed in. Every other
        unsuccessful answer is a failure to find out rather than a refusal, and `api` throws on it:
        telling a legitimate member they are not one is an answer that is wrong, unactionable and
        indistinguishable in the log from a real refusal.
      */
      const member = await this.api(
        `/users/@me/guilds/${encodeURIComponent(serverId)}/member`,
        bearer
      )
      if (!member) {
        // -> 404, which Discord uses for both cases. Said as both, since a mistyped Server ID and a
        //    person who is not in the server are one answer here and two different things to fix
        strategyDebug(
          this,
          `${account.username} is not in server ${serverId}, or there is no such server`
        )
        throw new Error('ERR_ACCOUNT_NOT_ALLOWED')
      }
      roleIds = Array.isArray(member.roles)
        ? member.roles.filter((id: unknown): id is string => typeof id === 'string')
        : []
    }

    const groups =
      this.conf.mapGroups === true ? await this.groupsFor(serverId, roleIds) : undefined
    strategyDebug(
      this,
      `${account.username} (${account.id}) signs in as <${account.email}>${groups ? `, holding ${groups.length} mapped role(s): ${groups.join(', ') || 'none'}` : ', groups not mapped'}`
    )

    return {
      id: String(account.id),
      email: account.email,
      // -> `global_name` is the display name; `username` is the handle, and is all an account that
      //    has not set one has
      name: account.global_name || account.username,
      picture: this.pictureFor(account),
      ...(groups
        ? {
            groups,
            groupsExclusive: this.conf.unassignMissingGroups === true
          }
        : {})
    }
  }
}
