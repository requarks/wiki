import fs from 'node:fs/promises'
import type { ConnectionOptions } from 'node:tls'
import { Client, Filter, InvalidCredentialsError } from 'ldapts'
import type { Entry, SearchOptions } from 'ldapts'
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
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    if (!searchFilter.includes('{{username}}')) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    /*
      An empty password is refused before the directory is asked, because most directories would
      answer it with an *unauthenticated* bind — a success that proves nothing. It is the oldest way
      into an LDAP-backed application and it must never reach the wire.
    */
    if (!username || !password) {
      throw new Error('ERR_LOGIN_FAILED')
    }

    const search = await this.connect()
    try {
      await search.bind(bindDn, this.conf.bindCredentials ?? '')

      const found = await search.search(searchBase, {
        scope: 'sub',
        filter: searchFilter.replaceAll('{{username}}', Filter.escape(username)),
        sizeLimit: 2,
        ...this.attributeOptions()
      })
      /*
        Exactly one entry, or nobody signs in. More than one means the filter does not identify a
        person — and then binding as "the first" of them would be authenticating whichever entry the
        directory happened to return first.
      */
      if (found.searchEntries.length !== 1) {
        throw new Error('ERR_LOGIN_FAILED')
      }
      const entry = found.searchEntries[0]

      await this.verifyPassword(entry.dn, password)

      const id = this.attr(entry, this.conf.mappingUID || 'uid')
      if (!id) {
        throw new Error('ERR_NO_PROVIDER_ACCOUNT')
      }
      const email = this.attr(entry, this.conf.mappingEmail || 'mail')
      if (!email) {
        throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
      }
      return {
        id,
        email,
        name: this.attr(entry, this.conf.mappingDisplayName || 'displayName') || email,
        pictureData: this.pictureFrom(entry),
        ...(this.conf.mapGroups === true
          ? {
              groups: await this.groupsFor(search, entry),
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
   */
  private async connect(): Promise<Client> {
    const secure = this.conf.url.toLowerCase().startsWith('ldaps://')
    // -> StartTLS on an `ldaps://` URL would be upgrading a connection that is already encrypted
    const startTls = this.conf.tlsEnabled === true && !secure
    const tlsOptions = secure || startTls ? await this.tlsOptions() : undefined
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
    const asUser = await this.connect()
    try {
      await asUser.bind(dn, password)
    } catch (err: any) {
      if (err instanceof InvalidCredentialsError) {
        throw new Error('ERR_LOGIN_FAILED')
      }
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
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    const nameField = this.conf.groupNameField || 'name'
    const dnProperty = this.conf.groupDnProperty || 'dn'
    const dnValue = dnProperty === 'dn' ? entry.dn : this.attr(entry, dnProperty)
    if (!dnValue) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }

    const found = await search.search(groupSearchBase, {
      scope: (this.conf.groupSearchScope || 'sub') as SearchOptions['scope'],
      filter: groupSearchFilter.replaceAll('{{dn}}', Filter.escape(dnValue)),
      attributes: [nameField]
    })
    return found.searchEntries
      .map((grp) => this.attr(grp, nameField))
      .filter((name): name is string => Boolean(name))
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
    return Buffer.isBuffer(first) && first.length > 0 ? first : undefined
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
    // -> The class name as well as the message: `ldapts` raises a result-code error whose message is
    //    only the code, and "InvalidCredentialsError" is what says the wiki's own bind DN is wrong
    WIKI.logger.warn(
      `LDAP strategy ${this.strategyId} could not complete a login: ${err.name}: ${err.message}`
    )
    return new Error('ERR_PROVIDER_REQUEST_FAILED')
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
