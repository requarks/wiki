import fs from 'node:fs/promises'
import type { ConnectionOptions } from 'node:tls'
import { Client, Filter, InvalidCredentialsError } from 'ldapts'
import type { Entry, SearchOptions } from 'ldapts'
import { describeAuthError, missingSettings, strategyDebug } from '../../../helpers/authDebug.ts'
import type { ProviderProfile } from '../../../models/authentication.ts'

/** What a form module is handed for one attempt. `login()` in `models/users.ts` assembles it. */
interface FormCredential {
  username: string
  password: string
}

/** How long any one directory operation may take before the login is failed. */
const OPERATION_TIMEOUT_MS = 10_000

/**
 * LDAP / Active Directory
 *
 * A form login whose password is checked by the directory rather than here: the wiki searches for the
 * entry the username names, then asks the directory to bind as that entry with the password given. A
 * bind that succeeds is the proof — nothing about the password is ever read, compared or stored on
 * this side, which is the whole point of authenticating against a directory.
 *
 * Because the credential lives elsewhere, this module answers with a `ProviderProfile` instead of a
 * user of this wiki. `models/users.ts` matches or creates the account from it, applies the strategy's
 * registration rules, and takes the groups and the avatar with it — the same path a redirect login
 * takes, and the reason `profile()` is the method implemented here rather than `authenticate()`.
 *
 * Two connections per login, not one. A bind is a property of the connection, so binding as the
 * person being authenticated would leave the search connection holding their rights: the group
 * lookup that follows is done as the wiki's own read-only account, and the password check gets a
 * connection of its own that is thrown away with it.
 */
export default class LdapAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  /**
   * The trusted CA, read from disk once.
   *
   * `null` until it has been looked for, so a directory with no extra certificate configured does not
   * go to the filesystem on every login either.
   */
  private ca: Buffer[] | null = null

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  /**
   * Who signed in, as the directory has them.
   *
   * @throws `ERR_LOGIN_FAILED` for a username the directory does not have or a password it refuses,
   *         `ERR_NO_PROVIDER_ACCOUNT` for an entry with no unique ID, `ERR_NO_EMAIL_FROM_PROVIDER`
   *         for one with no address, `ERR_STRATEGY_MISCONFIGURED` when the strategy cannot be used at
   *         all, and `ERR_PROVIDER_REQUEST_FAILED` when the directory could not be reached
   */
  async profile({ username, password }: FormCredential): Promise<ProviderProfile> {
    const { url, bindDn, searchBase, searchFilter } = this.conf
    if (!url || !bindDn || !searchBase || !searchFilter) {
      strategyDebug(
        this,
        `is not configured: ${missingSettings({ 'LDAP URL': url, 'Admin Bind DN': bindDn, 'Search Base': searchBase, 'Search Filter': searchFilter })}, so no login can be attempted`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    if (!searchFilter.includes('{{username}}')) {
      strategyDebug(
        this,
        `cannot look anybody up: the Search Filter \`${searchFilter}\` has no {{username}} placeholder for the typed username to go in`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    /*
      An empty password is refused before the directory is asked, because most directories would
      answer it with an *unauthenticated* bind — a success that proves nothing. It is the oldest way
      into an LDAP-backed application and it must never reach the wire.
    */
    if (!username || !password) {
      strategyDebug(
        this,
        `refused an attempt with ${username ? 'an empty password' : 'no username'} without asking the directory`
      )
      throw new Error('ERR_LOGIN_FAILED')
    }

    /*
      Opening the connection is inside the same reporting as everything after it: with StartTLS
      configured, `connect` upgrades the connection there and then, so a directory that cannot be
      reached fails HERE rather than on the bind below — and left outside, the socket error escaped
      `asLoginError` and became the code the login screen showed somebody.
    */
    let search: Client
    try {
      search = await this.connect('the user search')
    } catch (err: any) {
      throw this.asLoginError(err)
    }
    try {
      try {
        await search.bind(bindDn, this.conf.bindCredentials ?? '')
      } catch (err: any) {
        /*
          The wiki's own account and not the person signing in — so this refuses every login until it
          is fixed, and it is worth saying apart from a bad password. Whether the credentials are set
          at all is said, since an empty one is what a directory that allows anonymous search hides.
        */
        strategyDebug(
          this,
          `the directory refused the wiki's own bind as \`${bindDn}\` (Admin Bind Credentials ${this.conf.bindCredentials ? 'set' : 'empty'}): ${describeAuthError(err)}`
        )
        throw err
      }

      const filter = searchFilter.replaceAll('{{username}}', Filter.escape(username))
      strategyDebug(this, `searching \`${searchBase}\` (scope sub) for \`${filter}\``)
      const found = await search.search(searchBase, {
        scope: 'sub',
        filter,
        sizeLimit: 2,
        ...this.attributeOptions()
      })
      /*
        Exactly one entry, or nobody signs in. More than one means the filter does not identify a
        person — and then binding as "the first" of them would be authenticating whichever entry the
        directory happened to return first.
      */
      if (found.searchEntries.length !== 1) {
        strategyDebug(
          this,
          found.searchEntries.length < 1
            ? `nothing under \`${searchBase}\` matched \`${filter}\` — check the Search Base and the Search Filter against the directory's own tree`
            : `more than one entry matched \`${filter}\`, so it does not identify one person: ${found.searchEntries.map((one) => one.dn).join(', ')}`
        )
        throw new Error('ERR_LOGIN_FAILED')
      }
      const entry = found.searchEntries[0]
      strategyDebug(this, `"${username}" is \`${entry.dn}\``)

      await this.verifyPassword(entry.dn, password)

      const uidField = this.conf.mappingUID || 'uid'
      const id = this.attr(entry, uidField)
      if (!id) {
        strategyDebug(
          this,
          `\`${entry.dn}\` has no \`${uidField}\` to be identified by. Its attributes are: ${this.attributeNames(entry)}`
        )
        throw new Error('ERR_NO_PROVIDER_ACCOUNT')
      }
      const emailField = this.conf.mappingEmail || 'mail'
      const email = this.attr(entry, emailField)
      if (!email) {
        strategyDebug(
          this,
          `\`${entry.dn}\` has no address in \`${emailField}\`, and an account here is matched by address. Its attributes are: ${this.attributeNames(entry)}`
        )
        throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
      }
      // -> Read before the answer rather than in it, so what the directory said about this person's
      //    groups is logged as part of the attempt and not only once a membership actually changes
      const groups = this.conf.mapGroups === true ? await this.groupsFor(search, entry) : undefined
      // -> Before the line below rather than in the answer, so that the log reads in the order the
      //    work happened and "signs in" is the last thing said about the attempt
      const pictureData = this.pictureFrom(entry)
      strategyDebug(
        this,
        `\`${entry.dn}\` signs in as <${email}> with id \`${id}\`${groups ? `, in ${groups.length} directory group(s)` : ', groups not mapped'}`
      )
      return {
        id,
        email,
        name: this.attr(entry, this.conf.mappingDisplayName || 'displayName') || email,
        pictureData,
        ...(groups
          ? {
              groups,
              groupsExclusive: this.conf.unassignMissingGroups === true
            }
          : {})
      }
    } catch (err: any) {
      throw this.asLoginError(err)
    } finally {
      await this.release(search)
    }
  }

  /**
   * A connection to the directory, encrypted as the configuration asks.
   *
   * `ldaps://` is encrypted from the first byte and takes the TLS options as it connects; StartTLS
   * opens in the clear and upgrades before anything is sent, which is a request of its own and so a
   * second round trip. Both end up at the same place, and which one a directory offers is not this
   * module's business — the URL says.
   *
   * @param purpose What this connection is for, for the log: there are two per login, and a failure
   *                on the second one is a different thing from a failure on the first
   */
  private async connect(purpose: string): Promise<Client> {
    const secure = this.conf.url.toLowerCase().startsWith('ldaps://')
    // -> StartTLS on an `ldaps://` URL would be upgrading a connection that is already encrypted
    const startTls = this.conf.tlsEnabled === true && !secure
    const tlsOptions = secure || startTls ? await this.tlsOptions() : undefined
    strategyDebug(
      this,
      `opening a connection for ${purpose} to ${this.conf.url} (${this.protection(secure, startTls)})`
    )
    const conn = new Client({
      url: this.conf.url,
      timeout: OPERATION_TIMEOUT_MS,
      connectTimeout: OPERATION_TIMEOUT_MS,
      /*
        Only for a URL that is asking for TLS from the outset. `ldapts` reads any non-empty
        `tlsOptions` as "connect with TLS" whatever the scheme says, so handing them over on a plain
        connection opens one with a ClientHello to a server expecting LDAP — which is a hang and then
        a parse error, not a helpful failure. StartTLS gets them on the upgrade instead, which is
        where they belong: the point of it is that the connection starts in the clear.
      */
      ...(secure ? { tlsOptions } : {})
    })
    if (startTls) {
      await conn.startTLS(tlsOptions)
    }
    return conn
  }

  /**
   * How the connection this login is being made over is protected, as a phrase for the log.
   *
   * Worth saying on every attempt because it is derived rather than configured: the URL's scheme
   * decides it, and "Use StartTLS" is silently ignored on an `ldaps://` URL that is encrypted
   * already. A wiki whose directory is being talked to in the clear should be able to see that here.
   */
  private protection(secure: boolean, startTls: boolean): string {
    if (!secure && !startTls) {
      return 'unencrypted'
    }
    const scheme = secure ? 'ldaps' : 'StartTLS'
    if (this.conf.verifyTLSCertificate === false) {
      return `${scheme}, certificate NOT verified`
    }
    return `${scheme}, certificate verified${this.conf.tlsCertPath ? ` against ${this.conf.tlsCertPath}` : ''}`
  }

  /**
   * How the directory's certificate is treated.
   *
   * An extra CA is added to the system's own rather than replacing it, so a directory behind an
   * internal authority is trusted without a wiki losing every public one — and it is only read at
   * all when the certificate is being verified, since there is nothing for it to say otherwise.
   */
  private async tlsOptions(): Promise<ConnectionOptions> {
    const rejectUnauthorized = this.conf.verifyTLSCertificate !== false
    if (!rejectUnauthorized || !this.conf.tlsCertPath) {
      return { rejectUnauthorized }
    }
    if (!this.ca) {
      this.ca = [await fs.readFile(this.conf.tlsCertPath)]
    }
    return { rejectUnauthorized, ca: this.ca }
  }

  /**
   * Ask the directory to bind as the entry, with the password that was typed.
   *
   * On its own connection, closed straight afterwards: this is the only place the password goes, and
   * a connection bound as somebody else has no further use here.
   */
  private async verifyPassword(dn: string, password: string): Promise<void> {
    const asUser = await this.connect('the password check')
    try {
      await asUser.bind(dn, password)
      strategyDebug(this, `the directory accepted the password for \`${dn}\``)
    } catch (err: any) {
      if (err instanceof InvalidCredentialsError) {
        /*
          Whatever the directory said with it: Active Directory reports a locked, disabled or expired
          account as invalid credentials too, and names which in a `data` code inside the message that
          `describe` prints. So this line is what separates "wrong password" from "this account cannot
          sign in at all", neither of which the login screen is told apart.
        */
        strategyDebug(
          this,
          `the directory refused the password for \`${dn}\`: ${describeAuthError(err)}`
        )
        throw new Error('ERR_LOGIN_FAILED')
      }
      strategyDebug(
        this,
        `the directory could not check the password for \`${dn}\`: ${describeAuthError(err)}`
      )
      throw err
    } finally {
      await this.release(asUser)
    }
  }

  /**
   * The names of the groups the directory puts this entry in.
   *
   * Read with the wiki's own read-only account, on the connection the user entry was found with.
   * A group search that fails is a failed login rather than a login with no groups: under
   * `unassignMissingGroups` the empty answer would be indistinguishable from the directory saying
   * this person belongs to nothing, and would take every mapped membership away.
   */
  private async groupsFor(search: Client, entry: Entry): Promise<string[]> {
    const { groupSearchBase, groupSearchFilter } = this.conf
    if (!groupSearchBase || !groupSearchFilter) {
      strategyDebug(
        this,
        `maps groups but ${missingSettings({ 'Group Search Base': groupSearchBase, 'Group Search Filter': groupSearchFilter })}, so there is nothing to search`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    const nameField = this.conf.groupNameField || 'name'
    const dnProperty = this.conf.groupDnProperty || 'dn'
    const dnValue = dnProperty === 'dn' ? entry.dn : this.attr(entry, dnProperty)
    if (!dnValue) {
      strategyDebug(
        this,
        `maps groups by the \`${dnProperty}\` of \`${entry.dn}\`, which the entry does not have. Its attributes are: ${this.attributeNames(entry)}`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }

    const scope = (this.conf.groupSearchScope || 'sub') as SearchOptions['scope']
    const filter = groupSearchFilter.replaceAll('{{dn}}', Filter.escape(dnValue))
    strategyDebug(this, `searching \`${groupSearchBase}\` (scope ${scope}) for \`${filter}\``)
    const found = await search.search(groupSearchBase, {
      scope,
      filter,
      attributes: [nameField]
    })
    const names = found.searchEntries
      .map((grp) => this.attr(grp, nameField))
      .filter((name): name is string => Boolean(name))
    /*
      Both numbers, because they differ for a reason worth seeing: an entry counted here but not named
      is a group whose `groupNameField` is not the attribute this is reading, which reads on the wiki
      side as a membership the directory did not grant.
    */
    strategyDebug(
      this,
      `${found.searchEntries.length} group entr${found.searchEntries.length === 1 ? 'y' : 'ies'} matched, ${names.length} named by \`${nameField}\`: ${names.join(', ') || 'none'}`
    )
    return names
  }

  /**
   * Which attributes to ask for.
   *
   * All of the user ones, because the four mappings are configurable and a directory holds far more
   * than the wiki knows to name — plus the picture as a buffer, since asking for `jpegPhoto` as a
   * string is asking for an image decoded as UTF-8.
   */
  private attributeOptions(): Pick<SearchOptions, 'attributes' | 'explicitBufferAttributes'> {
    const picture = this.conf.mappingPicture
    return {
      attributes: ['*'],
      ...(picture ? { explicitBufferAttributes: [picture] } : {})
    }
  }

  /**
   * One attribute of an entry, as a string.
   *
   * LDAP attributes are multi-valued, and a directory is free to answer with one value or a list of
   * them for the same attribute — a person with two addresses in `mail` is ordinary. The first is
   * taken, which is the same choice every LDAP-backed application makes.
   */
  private attr(entry: Entry, name: string): string | undefined {
    const value = entry[name]
    const first = Array.isArray(value) ? value[0] : value
    if (first === undefined) {
      return undefined
    }
    const text = Buffer.isBuffer(first) ? first.toString('utf8') : first
    return text.trim().length > 0 ? text.trim() : undefined
  }

  /** The photo held in the entry, when the configuration names an attribute holding one. */
  private pictureFrom(entry: Entry): Buffer | undefined {
    const name = this.conf.mappingPicture
    if (!name) {
      return undefined
    }
    const value = entry[name]
    const first = Array.isArray(value) ? value[0] : value
    if (!Buffer.isBuffer(first) || first.length < 1) {
      strategyDebug(
        this,
        `\`${entry.dn}\` carries no image in \`${name}\`, so no avatar was taken from the directory`
      )
      return undefined
    }
    return first
  }

  /**
   * Turn whatever the directory or the network raised into a code the login screen can put in front
   * of somebody.
   *
   * An `ERR_` message is already one and is passed through. Anything else is the directory being
   * unreachable, misconfigured or unhappy, which is not the person's fault and must not read as a
   * wrong password — so it is logged as itself and reported as a provider failure.
   */
  private asLoginError(err: any): Error {
    if (typeof err?.message === 'string' && err.message.startsWith('ERR_')) {
      return err
    }
    WIKI.logger.warn(
      `LDAP strategy ${this.strategyId} could not complete a login: ${describeAuthError(err)}`
    )
    return new Error('ERR_PROVIDER_REQUEST_FAILED')
  }

  /**
   * The attribute names an entry came back with.
   *
   * Names only — a directory holds a person's password hash and rather more besides, and none of the
   * values are anybody's business here. What the list answers is the question a failed mapping raises:
   * the search asks for every attribute, so this is exactly what the four Field Mapping settings have
   * to be chosen from.
   */
  private attributeNames(entry: Entry): string {
    const names = Object.keys(entry).filter((key) => key !== 'dn')
    return names.length > 0 ? names.join(', ') : 'none'
  }

  /** Close a connection without letting the close itself fail a login that already succeeded. */
  private async release(conn: Client): Promise<void> {
    try {
      await conn.unbind()
    } catch (err: any) {
      WIKI.logger.debug(`LDAP strategy ${this.strategyId} could not unbind cleanly: ${err.message}`)
    }
  }
}
