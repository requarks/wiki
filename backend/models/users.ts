import bcrypt from 'bcryptjs'
import {
  authentication as authenticationTable,
  groups as groupsTable,
  sessions as sessionsTable,
  userAvatars,
  userGroups,
  users as usersTable,
  userKeys
} from '../db/schema.ts'
import { and, count, eq, ilike, inArray, notExists, or, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { flatten, uniq } from 'es-toolkit/array'
import { detectImageMime, resizeImageToSquareJpeg } from '../helpers/images.ts'
import type { SystemIds } from './types.ts'

/** The essential user fields, mirroring the `UserCore` API schema. */
export interface UserCore {
  id: string
  name: string
  email: string
  hasAvatar: boolean
  isSystem: boolean
  isActive: boolean
  isVerified: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}

/** One page of users, with the total matching the filter rather than the page size. */
export interface UserPage {
  total: number
  users: UserCore[]
}

/**
 * An authentication provider linked to a user, as exposed by the API. Secrets held in the stored
 * `auth` blob (the password hash, the TFA secret) are never included — `isPasswordSet` and
 * `tfaIsActive` report their state instead.
 */
export interface UserAuthProvider {
  authId: string
  authName: string
  strategyKey: string
  strategyIcon: string
  config: Record<string, any>
}

/** The subset of user fields that may be modified. `isSystem` is deliberately absent. */
export interface UserPatch {
  name?: string
  email?: string
  isActive?: boolean
  isVerified?: boolean
  meta?: Record<string, any>
  prefs?: Record<string, any>
}

/**
 * The self-service view of a user, flattening the `meta` and `prefs` blobs into the fields the
 * profile page shows. Mirrors the `UserProfile` API schema.
 */
export interface UserProfile {
  id: string
  name: string
  email: string
  hasAvatar: boolean
  location: string
  jobTitle: string
  pronouns: string
  timezone: string
  dateFormat: string
  timeFormat: string
  appearance: string
  cvd: string
}

/** The fields a user may change on its own profile. Notably not the email, nor any admin flag. */
export interface UserProfilePatch {
  name?: string
  location?: string
  jobTitle?: string
  pronouns?: string
  timezone?: string
  dateFormat?: string
  timeFormat?: string
  appearance?: string
  cvd?: string
}

/** The `meta` keys the profile owns, and the `prefs` keys it owns. */
const profileMetaKeys = ['location', 'jobTitle', 'pronouns'] as const
const profilePrefsKeys = ['timezone', 'dateFormat', 'timeFormat', 'appearance', 'cvd'] as const

/**
 * The square, in pixels, an avatar is resized to. The profile page and the account menu both display
 * one at 180px; nothing displays one larger.
 */
const avatarSize = 180

/**
 * Escape the LIKE wildcards `%` and `_` (and the escape character itself) so that a user-supplied
 * filter is matched literally. Values are still parameterized by the driver — this is about a `%`
 * in the filter silently matching everything, not about injection.
 */
function escapeLikePattern(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

/** Selection shared by the list / detail queries. Never includes `auth` or `passkeys`. */
const userSelection = {
  id: usersTable.id,
  name: usersTable.name,
  email: usersTable.email,
  hasAvatar: usersTable.hasAvatar,
  isSystem: usersTable.isSystem,
  isActive: usersTable.isActive,
  isVerified: usersTable.isVerified,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
  lastLoginAt: usersTable.lastLoginAt
}

export interface LoginOptions {
  siteId: string
  strategyId: string
  username?: string
  password?: string
  ip?: string
}

export interface AfterLoginResult {
  authenticated?: boolean
  nextAction: string
  continuationToken?: string
  tfaQRImage?: string
  redirect: string
}

/**
 * Users model
 */
class Users {
  async getByEmail(email: string) {
    const res = await WIKI.db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1)
    return res?.[0] ?? null
  }

  async getById(id: string) {
    const res = await WIKI.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1)
    return res?.[0] ?? null
  }

  /**
   * Fetch a page of users, optionally filtered by name or email
   *
   * @param filter Matched literally against name and email, case-insensitively
   * @param assignableToGroupId Keep only the users that may be assigned to this group
   * @returns The page of users plus the total number matching the filter
   */
  async getUsers({
    filter = '',
    assignableToGroupId = '',
    page = 1,
    limit = 20
  }: {
    filter?: string
    assignableToGroupId?: string
    page?: number
    limit?: number
  } = {}): Promise<UserPage> {
    const conditions = []
    if (filter) {
      const pattern = `%${escapeLikePattern(filter)}%`
      conditions.push(or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern))!)
    }
    if (assignableToGroupId) {
      // -> Members of the group have nothing left to assign, and system users (the guest account)
      //    have a fixed membership that `POST /groups/:id/users/:id` refuses to change
      conditions.push(eq(usersTable.isSystem, false))
      conditions.push(
        notExists(
          WIKI.db
            .select({ exists: sql`1` })
            .from(userGroups)
            .where(
              and(eq(userGroups.userId, usersTable.id), eq(userGroups.groupId, assignableToGroupId))
            )
        )
      )
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const totals = await WIKI.db.select({ total: count() }).from(usersTable).where(where)
    const users = await WIKI.db
      .select(userSelection)
      .from(usersTable)
      .where(where)
      .orderBy(usersTable.name)
      .limit(limit)
      .offset((page - 1) * limit)

    return {
      total: totals[0]?.total ?? 0,
      users
    }
  }

  /**
   * Fetch a single user with the groups it belongs to and the authentication providers linked to it.
   *
   * The stored `auth` blob is keyed by strategy ID and holds secrets, so it is reshaped into a list
   * of providers carrying only state (`isPasswordSet`, `tfaIsActive`) — never the password hash or
   * the TFA secret.
   *
   * @param id User ID
   * @returns The user, or null if no such user exists
   */
  async getUserDetail(id: string) {
    const results = await WIKI.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1)
    const user = results[0]
    if (!user) {
      return null
    }

    const groups = await this.getUserGroups(id)

    const strategies = await WIKI.db.select().from(authenticationTable)
    const auth: UserAuthProvider[] = []
    for (const [strategyId, rawConfig] of Object.entries(
      (user.auth ?? {}) as Record<string, any>
    )) {
      const strategy = strategies.find((s: any) => s.id === strategyId)
      const definition = WIKI.data.authentication?.find((d: any) => d.key === strategy?.module)
      const { password, tfaSecret, ...config } = rawConfig ?? {}
      auth.push({
        authId: strategyId,
        authName: strategy?.displayName || definition?.title || strategy?.module || 'Unknown',
        strategyKey: strategy?.module ?? 'unknown',
        strategyIcon: definition?.icon ?? '',
        config: {
          ...config,
          isPasswordSet: Boolean(password),
          tfaIsActive: Boolean(tfaSecret)
        }
      })
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      hasAvatar: user.hasAvatar,
      isSystem: user.isSystem,
      isActive: user.isActive,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      meta: user.meta,
      prefs: user.prefs,
      auth,
      groups
    }
  }

  /**
   * Create a new user, authenticated against the local strategy.
   *
   * @returns The new user's ID
   */
  async createUser({
    name,
    email,
    password,
    groups = [],
    mustChangePassword = false,
    isVerified = true
  }: {
    name: string
    email: string
    password: string
    groups?: string[]
    mustChangePassword?: boolean
    /**
     * Defaults to true: an administrator creating the account vouches for the address, and login
     * rejects unverified users with `ERR_USER_NOT_VERIFIED` — which no email can currently clear.
     */
    isVerified?: boolean
  }): Promise<string> {
    const localStrategyId = WIKI.data.systemIds.localAuthId
    const result = await WIKI.db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        name,
        auth: {
          [localStrategyId]: {
            password: await bcrypt.hash(password, 12),
            mustChangePwd: mustChangePassword,
            restrictLogin: false,
            tfaIsActive: false,
            tfaRequired: false,
            tfaSecret: ''
          }
        },
        isSystem: false,
        isActive: true,
        isVerified,
        meta: {
          location: '',
          jobTitle: '',
          pronouns: ''
        },
        prefs: {
          // -> Seeded from the instance-wide user defaults, which an administrator can change
          timezone: WIKI.config.userDefaults?.timezone ?? 'America/New_York',
          dateFormat: WIKI.config.userDefaults?.dateFormat ?? 'YYYY-MM-DD',
          timeFormat: WIKI.config.userDefaults?.timeFormat ?? '12h',
          appearance: 'site',
          cvd: 'none'
        }
      })
      .returning({ id: usersTable.id })

    const userId = result[0].id
    if (groups.length > 0) {
      await this.setUserGroups(userId, groups)
    }

    WIKI.models.flags.authDebug(
      `Created user ${userId} <${email.toLowerCase()}> in ${groups.length} group(s), mustChangePwd: ${mustChangePassword}, verified: ${isVerified}`
    )

    await WIKI.models.hooks.emit('user:join', {
      userId,
      metadata: {
        name,
        email: email.toLowerCase()
      }
    })

    return userId
  }

  /**
   * Update a user's own fields. Group membership is handled by `setUserGroups()`.
   *
   * @param patch Fields to change — must not be empty
   * @returns Whether a user was updated
   */
  async updateUser(id: string, patch: UserPatch): Promise<boolean> {
    const values: Record<string, any> = { ...patch, updatedAt: sql`now()` }
    if (typeof values.email === 'string') {
      values.email = values.email.toLowerCase()
    }
    const result = await WIKI.db.update(usersTable).set(values).where(eq(usersTable.id, id))
    return (result.rowCount ?? 0) > 0
  }

  /**
   * The profile of a single user, as shown on its own profile page.
   *
   * `meta` and `prefs` are free-form blobs, so every field is defaulted here rather than trusted to
   * be present — a user created before a given key existed simply has none.
   *
   * @returns The profile, or null if no such user exists
   */
  async getProfile(id: string): Promise<UserProfile | null> {
    const user = await this.getById(id)
    if (!user) {
      return null
    }
    const meta = (user.meta ?? {}) as Record<string, any>
    const prefs = (user.prefs ?? {}) as Record<string, any>
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      hasAvatar: user.hasAvatar,
      location: meta.location ?? '',
      jobTitle: meta.jobTitle ?? '',
      pronouns: meta.pronouns ?? '',
      // -> An empty time zone / date format means "whatever the client resolves", which is what the
      //    profile page falls back to
      timezone: prefs.timezone ?? '',
      dateFormat: prefs.dateFormat ?? '',
      timeFormat: prefs.timeFormat ?? '12h',
      appearance: prefs.appearance ?? 'site',
      cvd: prefs.cvd ?? 'none'
    }
  }

  /**
   * A user's own settings for one editor.
   *
   * Kept under `prefs.editors[editor]` so each editor owns its own blob and adding a second one
   * needs no migration. The shape is whatever that editor saves; this only guarantees an object.
   *
   * @returns The saved settings, or `{}` for a user who has never saved any
   */
  async getEditorSettings(id: string, editor: string): Promise<Record<string, any>> {
    const user = await this.getById(id)
    if (!user) {
      return {}
    }
    const prefs = (user.prefs ?? {}) as Record<string, any>
    return (prefs.editors?.[editor] ?? {}) as Record<string, any>
  }

  /**
   * Replace a user's settings for one editor.
   *
   * Merges at both levels for the same reason `updateProfile` does: another editor's settings, and
   * every other preference, have to survive one editor saving its own.
   *
   * @returns The saved settings, or null if no such user exists
   */
  async setEditorSettings(
    id: string,
    editor: string,
    config: Record<string, any>
  ): Promise<Record<string, any> | null> {
    const user = await this.getById(id)
    if (!user) {
      return null
    }
    const prefs = { ...((user.prefs ?? {}) as Record<string, any>) }
    prefs.editors = { ...((prefs.editors ?? {}) as Record<string, any>), [editor]: config }
    await this.updateUser(id, { prefs })
    return config
  }

  /**
   * Update a user's own profile fields, merging into the `meta` and `prefs` blobs rather than
   * replacing them — an administrator's notes and any key this endpoint does not expose must survive
   * a user saving its profile.
   *
   * @param patch Fields to change; omitted ones are left as they are
   * @returns The updated profile, or null if no such user exists
   */
  async updateProfile(id: string, patch: UserProfilePatch): Promise<UserProfile | null> {
    const user = await this.getById(id)
    if (!user) {
      return null
    }

    const meta = { ...((user.meta ?? {}) as Record<string, any>) }
    const prefs = { ...((user.prefs ?? {}) as Record<string, any>) }
    for (const key of profileMetaKeys) {
      if (patch[key] !== undefined) {
        meta[key] = patch[key]
      }
    }
    for (const key of profilePrefsKeys) {
      if (patch[key] !== undefined) {
        prefs[key] = patch[key]
      }
    }

    const values: UserPatch = { meta, prefs }
    if (patch.name !== undefined) {
      values.name = patch.name
    }
    await this.updateUser(id, values)

    return this.getProfile(id)
  }

  /**
   * A user's avatar, with the type its bytes say it is.
   *
   * The type is sniffed rather than stored: an avatar written while Sharp was installed is a JPEG,
   * one written without it is whatever was uploaded, and nothing records which. Unrecognizable bytes
   * are reported as JPEG, which is what every avatar stored by 2.x is.
   *
   * @returns The avatar, or null if this user has none
   */
  async getAvatar(userId: string): Promise<{ data: Buffer; mime: string } | null> {
    const rows = await WIKI.db
      .select({ data: userAvatars.data })
      .from(userAvatars)
      .where(eq(userAvatars.id, userId))
      .limit(1)
    const data = rows[0]?.data
    if (!data) {
      return null
    }
    return { data, mime: detectImageMime(data) ?? 'image/jpeg' }
  }

  /**
   * Replace a user's avatar.
   *
   * Normalized to a square JPEG when the Sharp extension is installed — an avatar is displayed at one
   * small size, so there is no reason to keep a multi-megabyte original around. Without Sharp the
   * uploaded bytes are stored as they came in, which is why reading one sniffs the type.
   *
   * @param data The uploaded image, already known to be one of the supported formats
   */
  async setAvatar(userId: string, data: Buffer): Promise<void> {
    const normalized = (await resizeImageToSquareJpeg(data, avatarSize)) ?? data
    await WIKI.db
      .insert(userAvatars)
      .values({ id: userId, data: normalized })
      .onConflictDoUpdate({ target: userAvatars.id, set: { data: normalized } })
    await WIKI.db
      .update(usersTable)
      .set({ hasAvatar: true, updatedAt: sql`now()` })
      .where(eq(usersTable.id, userId))
  }

  /**
   * Remove a user's avatar, leaving it to be rendered as initials again.
   */
  async clearAvatar(userId: string): Promise<void> {
    await WIKI.db.delete(userAvatars).where(eq(userAvatars.id, userId))
    await WIKI.db
      .update(usersTable)
      .set({ hasAvatar: false, updatedAt: sql`now()` })
      .where(eq(usersTable.id, userId))
  }

  /**
   * The groups a user belongs to, by name. Only the identity of each group — never its permissions or
   * page rules, which a user has no business reading about itself.
   */
  async getUserGroups(userId: string): Promise<Array<{ id: string; name: string }>> {
    return WIKI.db
      .select({ id: groupsTable.id, name: groupsTable.name })
      .from(userGroups)
      .innerJoin(groupsTable, eq(groupsTable.id, userGroups.groupId))
      .where(eq(userGroups.userId, userId))
      .orderBy(groupsTable.name)
  }

  /**
   * The IDs of the groups a user belongs to
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    const rows = await WIKI.db
      .select({ groupId: userGroups.groupId })
      .from(userGroups)
      .where(eq(userGroups.userId, userId))
    return rows.map((r: any) => r.groupId)
  }

  /**
   * Replace a user's group membership with exactly the given groups.
   *
   * Unknown group IDs are ignored rather than failing the whole update, so that a stale client does
   * not block an otherwise valid save.
   */
  async setUserGroups(userId: string, groupIds: string[]): Promise<void> {
    const wanted =
      groupIds.length > 0
        ? await WIKI.db
            .select({ id: groupsTable.id })
            .from(groupsTable)
            .where(inArray(groupsTable.id, groupIds))
        : []
    const wantedIds = wanted.map((g: any) => g.id)

    await WIKI.db.delete(userGroups).where(eq(userGroups.userId, userId))
    if (wantedIds.length > 0) {
      await WIKI.db
        .insert(userGroups)
        .values(wantedIds.map((groupId: string) => ({ userId, groupId })))
    }
  }

  /**
   * Update the local-strategy behaviour flags for a user, leaving secrets and any other linked
   * provider untouched.
   *
   * @param flags Any of `mustChangePwd`, `restrictLogin`, `tfaRequired`
   * @returns False if the user does not exist
   */
  async setUserAuthFlags(id: string, flags: Record<string, any>): Promise<boolean> {
    const user = await this.getById(id)
    if (!user) {
      return false
    }

    const localStrategyId = WIKI.data.systemIds.localAuthId
    const auth = (user.auth ?? {}) as Record<string, any>
    const current = auth[localStrategyId]
    if (!current) {
      // -> The user does not use local authentication, so there are no local flags to set
      return false
    }

    for (const key of ['mustChangePwd', 'restrictLogin', 'tfaRequired'] as const) {
      if (flags[key] !== undefined) {
        current[key] = Boolean(flags[key])
      }
    }
    auth[localStrategyId] = current

    await WIKI.db
      .update(usersTable)
      .set({ auth, updatedAt: sql`now()` })
      .where(eq(usersTable.id, id))
    return true
  }

  /**
   * Set a user's local-strategy password, leaving any other linked provider untouched.
   *
   * @returns False if the user does not exist
   */
  async setUserPassword({
    id,
    newPassword,
    mustChangePassword = false
  }: {
    id: string
    newPassword: string
    mustChangePassword?: boolean
  }): Promise<boolean> {
    const user = await this.getById(id)
    if (!user) {
      return false
    }

    const localStrategyId = WIKI.data.systemIds.localAuthId
    const auth = (user.auth ?? {}) as Record<string, any>
    auth[localStrategyId] = {
      ...auth[localStrategyId],
      password: await bcrypt.hash(newPassword, 12),
      mustChangePwd: mustChangePassword
    }

    await WIKI.db
      .update(usersTable)
      .set({ auth, updatedAt: sql`now()` })
      .where(eq(usersTable.id, id))
    return true
  }

  /**
   * Delete a user.
   *
   * Group assignments cascade, but sessions and keys do not — they are login artifacts, so they are
   * cleared here rather than blocking the delete. References from authored content (pages, assets)
   * have no cascade either and will make this throw, which is deliberate: the delete is refused
   * rather than silently orphaning content.
   *
   * @returns Whether a user was deleted
   */
  async deleteUser(id: string): Promise<boolean> {
    await WIKI.db.delete(userKeys).where(eq(userKeys.userId, id))
    await WIKI.db.delete(sessionsTable).where(eq(sessionsTable.userId, id))
    const result = await WIKI.db.delete(usersTable).where(eq(usersTable.id, id))
    return (result.rowCount ?? 0) > 0
  }

  async init(ids: SystemIds): Promise<void> {
    WIKI.logger.info('Inserting default users...')

    await WIKI.db.insert(usersTable).values([
      {
        id: ids.userAdminId,
        email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
        auth: {
          [ids.authModuleId]: {
            password: await bcrypt.hash(process.env.ADMIN_PASS || '12345678', 12),
            mustChangePwd: !process.env.ADMIN_PASS,
            restrictLogin: false,
            tfaIsActive: false,
            tfaRequired: false,
            tfaSecret: ''
          }
        },
        name: 'Administrator',
        isSystem: false,
        isActive: true,
        isVerified: true,
        meta: {
          location: '',
          jobTitle: '',
          pronouns: ''
        },
        prefs: {
          timezone: 'America/New_York',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '12h',
          appearance: 'site',
          cvd: 'none'
        }
      },
      {
        id: ids.userGuestId,
        email: 'guest@example.com',
        auth: {},
        name: 'Guest',
        isSystem: true,
        isActive: true,
        isVerified: true,
        meta: {},
        prefs: {
          timezone: 'America/New_York',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '12h',
          appearance: 'site',
          cvd: 'none'
        }
      }
    ])

    await WIKI.db.insert(userGroups).values([
      {
        userId: ids.userAdminId,
        groupId: ids.groupAdminId
      },
      {
        userId: ids.userGuestId,
        groupId: ids.groupGuestId
      }
    ])
  }

  async login(
    { siteId, strategyId, username, password, ip }: LoginOptions,
    req: any
  ): Promise<AfterLoginResult> {
    if (strategyId in WIKI.auth.strategies) {
      const str = WIKI.auth.strategies[strategyId] as any
      const strInfo = WIKI.data.authentication.find((a: any) => a.key === str.module)
      const context = {
        ip,
        siteId,
        ...(strInfo.useForm && {
          username,
          password
        })
      }

      // -> Never the password, flag or no flag
      WIKI.models.flags.authDebug(
        `Login attempt on site ${siteId} using ${str.module} strategy ${strategyId}${username ? ` as "${username}"` : ''} from ${ip}`
      )

      // Authenticate
      let user
      try {
        user = await str.authenticate(context)
      } catch (err: any) {
        WIKI.models.flags.authDebug(
          `Strategy ${str.module} rejected the attempt${username ? ` for "${username}"` : ''}: ${err.message}`
        )
        throw err
      }

      // Perform post-login checks
      return this.afterLoginChecks(
        user,
        strategyId,
        context,
        {
          skipTFA: !strInfo.useForm,
          skipChangePwd: !strInfo.useForm
        },
        req
      )
    } else {
      WIKI.models.flags.authDebug(`Login attempt using unknown strategy ${strategyId} from ${ip}`)
      throw new Error('Invalid Strategy ID')
    }
  }

  async afterLoginChecks(
    user: any,
    strategyId: string,
    context: any,
    { skipTFA, skipChangePwd }: { skipTFA?: boolean; skipChangePwd?: boolean } = {
      skipTFA: false,
      skipChangePwd: false
    },
    req?: any
  ): Promise<AfterLoginResult> {
    const str = WIKI.auth.strategies[strategyId] as any
    if (!str) {
      throw new Error('ERR_INVALID_STRATEGY')
    }

    // Get user groups
    user.groups = await WIKI.db.query.users
      .findFirst({
        columns: {},
        where: {
          id: user.id
        },
        with: {
          groups: {
            columns: {
              id: true,
              permissions: true,
              redirectOnLogin: true
            }
          }
        }
      })
      .then((r: any) => r?.groups || [])

    // Get redirect target
    let redirect = '/'
    if (user.groups && user.groups.length > 0) {
      for (const grp of user.groups as any[]) {
        if (grp.redirectOnLogin && grp.redirectOnLogin !== '/') {
          redirect = grp.redirectOnLogin
          break
        }
      }
    }

    // Get auth strategy flags
    const authStr = user.auth[strategyId] || {}

    // Is 2FA required?
    if (!skipTFA) {
      if (authStr.tfaIsActive && authStr.tfaSecret) {
        try {
          // FIXME: pre-existing bug — `WIKI.db.userKeys` is leftover Objection.js API and does not
          // exist on a Drizzle instance, so this throws a TypeError. The intended call is
          // `this.generateToken({ ... })`, as used further down in this same file.
          const tfaToken = await (WIKI.db as any).userKeys.generateToken({
            kind: 'tfa',
            userId: user.id,
            meta: {
              strategyId
            }
          })
          WIKI.models.flags.authDebug(
            `User ${user.id} <${user.email}> authenticated, but a 2FA code is required first`
          )
          return {
            nextAction: 'provideTfa',
            continuationToken: tfaToken,
            redirect
          }
        } catch (errc) {
          WIKI.logger.warn(errc)
          throw new WIKI.Error.AuthGenericError()
        }
      } else if (str.config?.enforceTfa || authStr.tfaRequired) {
        try {
          const tfaQRImage = await user.generateTFA(strategyId, context.siteId)
          // FIXME: pre-existing bug — `WIKI.db.userKeys` is leftover Objection.js API and does not
          // exist on a Drizzle instance, so this throws a TypeError. The intended call is
          // `this.generateToken({ ... })`, as used further down in this same file.
          const tfaToken = await (WIKI.db as any).userKeys.generateToken({
            kind: 'tfaSetup',
            userId: user.id,
            meta: {
              strategyId
            }
          })
          WIKI.models.flags.authDebug(
            `User ${user.id} <${user.email}> authenticated, but must set up 2FA first`
          )
          return {
            nextAction: 'setupTfa',
            continuationToken: tfaToken,
            tfaQRImage,
            redirect
          }
        } catch (errc) {
          WIKI.logger.warn(errc)
          throw new WIKI.Error.AuthGenericError()
        }
      }
    }

    // Must Change Password?
    if (!skipChangePwd && authStr.mustChangePwd) {
      try {
        const pwdChangeToken = await this.generateToken({
          kind: 'changePwd',
          userId: user.id,
          meta: {
            strategyId
          }
        })

        WIKI.models.flags.authDebug(
          `User ${user.id} <${user.email}> authenticated, but must change their password first`
        )
        return {
          nextAction: 'changePassword',
          continuationToken: pwdChangeToken,
          redirect
        }
      } catch (errc) {
        WIKI.logger.warn(errc)
        throw new WIKI.Error.AuthGenericError()
      }
    }

    // Set Session Data
    this.updateSession(user, req)

    WIKI.models.flags.authDebug(
      `User ${user.id} <${user.email}> logged in with ${user.groups.length} group(s) and ${req?.session?.permissions?.length ?? 0} permission(s), redirecting to ${redirect}`
    )

    // -> Only once the login has actually succeeded: an attempt stopped by 2FA or a forced password
    //    change is not a login yet
    await WIKI.models.hooks.emit('user:login', {
      userId: user.id,
      strategyId,
      ip: context.ip,
      metadata: {
        name: user.name,
        email: user.email
      }
    })

    return {
      authenticated: true,
      nextAction: 'redirect',
      redirect
    }
  }

  /**
   * Where to send a user after logging out.
   *
   * A group's own target wins over the site's, which is what the admin area promises: the site setting
   * says it "can be overridden at the group level". With several groups the first one that names a
   * target wins, the same arbitrary-but-stable rule the login redirect uses.
   *
   * @param userId The user logging out, or null for a request that was not logged in
   * @param siteId The site being logged out of, if it is known
   * @returns A path or URL, never empty — the site root when nothing is configured
   */
  async getLogoutRedirect(userId: string | null, siteId?: string): Promise<string> {
    if (userId) {
      const groups = await WIKI.db.query.users
        .findFirst({
          columns: {},
          where: {
            id: userId
          },
          with: {
            groups: {
              columns: {
                redirectOnLogout: true
              }
            }
          }
        })
        .then((r: any) => r?.groups ?? [])
      for (const grp of groups as any[]) {
        if (grp.redirectOnLogout && grp.redirectOnLogout !== '/') {
          return grp.redirectOnLogout
        }
      }
    }

    const site = siteId ? await WIKI.models.sites.getSiteById({ id: siteId }) : null
    return site?.config?.auth?.logoutRedirect || '/'
  }

  async loginChangePassword(
    {
      strategyId,
      siteId,
      continuationToken,
      newPassword,
      ip
    }: {
      strategyId: string
      siteId: string
      continuationToken: string
      newPassword: string
      ip?: string
    },
    req: any
  ): Promise<AfterLoginResult> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('ERR_PASSWORD_TOO_SHORT')
    }
    const { user, strategyId: expectedStrategyId } = await this.validateToken({
      kind: 'changePwd',
      token: continuationToken
    })

    if (strategyId !== expectedStrategyId) {
      throw new Error('ERR_INVALID_STRATEGY')
    }

    if (user) {
      user.auth[strategyId].password = await bcrypt.hash(newPassword, 12)
      user.auth[strategyId].mustChangePwd = false
      await WIKI.db.update(usersTable).set({ auth: user.auth }).where(eq(usersTable.id, user.id))

      return this.afterLoginChecks(
        user,
        strategyId,
        { ip, siteId },
        { skipChangePwd: true, skipTFA: true },
        req
      )
    } else {
      throw new Error('ERR_INVALID_USER')
    }
  }

  updateSession(user: any, req: any): void {
    req.session.authenticated = true
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      hasAvatar: user.hasAvatar,
      timezone: user.prefs?.timezone,
      dateFormat: user.prefs?.dateFormat,
      timeFormat: user.prefs?.timeFormat,
      appearance: user.prefs?.appearance,
      cvd: user.prefs?.cvd
    }
    req.session.permissions = uniq(flatten(user.groups?.map((g: any) => g.permissions)))
    // -> Group ids as well as their permissions, since navigation items are limited per group
    req.session.groups = (user.groups ?? []).map((g: any) => g.id)
  }

  async generateToken({
    userId,
    kind,
    meta = {}
  }: {
    userId: string
    kind: string
    meta?: Record<string, any>
  }): Promise<string> {
    WIKI.logger.debug(`Generating ${kind} token for user ${userId}...`)
    const token = await nanoid()
    await WIKI.db.insert(userKeys).values({
      kind,
      token,
      meta,
      // NOTE: ISO string rather than a Date, for the same UTC-vs-local reason as models/jobs.ts.
      //       24 hours rather than 1 day: Temporal.Instant takes exact time units only, and in UTC
      //       a calendar day is exactly 24 hours.
      validUntil: Temporal.Now.instant()
        .add({ hours: 24 })
        .toString({ smallestUnit: 'millisecond' }) as any,
      userId
    })
    return token
  }

  async validateToken({
    kind,
    token,
    skipDelete
  }: {
    kind: string
    token: string
    skipDelete?: boolean
  }): Promise<any> {
    const res = await WIKI.db.query.userKeys.findFirst({
      where: {
        kind,
        token
      },
      with: {
        user: true
      }
    })
    if (res) {
      if (skipDelete !== true) {
        await WIKI.db.delete(userKeys).where(eq(userKeys.id, res.id))
      }
      // -> BEHAVIOR CHANGE (Temporal migration): this previously read
      //    `DateTime.utc() > DateTime.fromISO(res.validUntil)`. `validUntil` is a `timestamp`
      //    column, so drizzle hands back a Date, and `fromISO` given a Date produced an *Invalid*
      //    DateTime whose comparison was always false — tokens never expired. Temporal has no
      //    Invalid sentinel to reproduce that with, so the check now works as intended.
      if (
        Temporal.Instant.compare(Temporal.Now.instant(), res.validUntil.toTemporalInstant()) > 0
      ) {
        throw new Error('ERR_EXPIRED_VALIDATION_TOKEN')
      }
      return {
        ...(res.meta as Record<string, any>),
        user: res.user
      }
    } else {
      throw new Error('ERR_INVALID_VALIDATION_TOKEN')
    }
  }

  async destroyToken({ token }: { token: string }) {
    return WIKI.db.delete(userKeys).where(eq(userKeys.token, token))
  }
}

export const users = new Users()
