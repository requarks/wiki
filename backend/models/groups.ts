import { v4 as uuid } from 'uuid'
import { and, count, eq, ilike, or, sql } from 'drizzle-orm'
import { groups as groupsTable, userGroups, users as usersTable } from '../db/schema.ts'
import { CustomError } from '../helpers/common.ts'
import { resolvePageRule, type RulePageRef } from '../helpers/pageRules.ts'
import type { SystemIds } from './types.ts'
import type { FastifyRequest } from 'fastify'

/** How a rule's `path` is compared against the page path. */
export type GroupRuleMatch = 'START' | 'END' | 'REGEX' | 'TAG' | 'TAGALL' | 'EXACT'

/** Whether a matching rule grants, denies, or unconditionally grants its roles. */
export type GroupRuleMode = 'ALLOW' | 'DENY' | 'FORCEALLOW'

/** A single page-rule entry within a group. */
export interface GroupRule {
  id: string
  name: string
  roles: string[]
  match: GroupRuleMatch
  mode: GroupRuleMode
  path: string
  locales: string[]
  sites: string[]
}

/** A group row, joined with the number of users assigned to it. */
export interface GroupWithUserCount {
  id: string
  name: string
  permissions: string[]
  rules: GroupRule[]
  redirectOnLogin: string
  redirectOnFirstLogin: string
  redirectOnLogout: string
  isSystem: boolean
  userCount: number
  createdAt: Date
  updatedAt: Date
}

/** The subset of group fields that may be modified. `isSystem` is deliberately absent. */
export interface GroupPatch {
  name?: string
  redirectOnLogin?: string
  redirectOnFirstLogin?: string
  redirectOnLogout?: string
  permissions?: string[]
  rules?: GroupRule[]
}

/**
 * Selection shared by getAllGroups() / getGroupById().
 *
 * `userCount` comes from a left join on `userGroups` aggregated per group, so groups with no members
 * count 0 rather than dropping out of the result.
 */
/** A member of a group, mirroring the `UserCore` API schema. */
export interface GroupUser {
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

export interface GroupUserPage {
  total: number
  users: GroupUser[]
}

/**
 * Escape the LIKE wildcards `%` and `_` (and the escape character itself) so that a user-supplied
 * filter is matched literally. Values are still parameterized by the driver — this is about a `%`
 * in the filter silently matching everything, not about injection.
 */
function escapeLikePattern(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

const groupSelection = {
  id: groupsTable.id,
  name: groupsTable.name,
  permissions: groupsTable.permissions,
  rules: groupsTable.rules,
  redirectOnLogin: groupsTable.redirectOnLogin,
  redirectOnFirstLogin: groupsTable.redirectOnFirstLogin,
  redirectOnLogout: groupsTable.redirectOnLogout,
  isSystem: groupsTable.isSystem,
  createdAt: groupsTable.createdAt,
  updatedAt: groupsTable.updatedAt,
  userCount: count(userGroups.userId)
}

/**
 * Who is asking, and what they hold outside the page rules.
 *
 * `permissions` is the group-wide list — `manage:system`, `access:admin` and the rest — which is a
 * different thing from the page permissions the rules decide.
 */
export interface AccessActor {
  groupIds: string[]
  permissions: string[]
}

/**
 * The page permissions a rule on the GUESTS group may grant.
 *
 * Reading, and saying something in a comment. Everything else — writing or deleting a page, managing
 * assets or comments, reviewing suggestions — is an action attributable to somebody, and the guests
 * group is precisely the absence of a somebody.
 *
 * Mirrored in `GroupEditOverlay.vue`, which offers exactly these when the guests group is open. This
 * copy is the one that decides.
 */
export const GUEST_ROLES = [
  'read:pages',
  'read:source',
  'read:history',
  'read:assets',
  'read:comments',
  'write:comments'
]

/**
 * Every group's rules, by group id.
 *
 * Cached because a page permission is checked on every page read, and reading three rows out of the
 * database to answer it would put a query in front of every request. Reloaded whenever a group
 * changes, the same way the site configurations are.
 */
let rulesCache: Record<string, GroupRule[]> = {}

/**
 * Groups model
 */
class Groups {
  /**
   * Reload the page rules of every group into memory.
   *
   * Called at boot and after any change to a group. A group edit therefore takes effect on the next
   * request rather than on the next login, which matters: rules are the whole of page access, and a
   * revoked permission that waits for a logout is not revoked.
   */
  async reloadCache(): Promise<void> {
    const rows = await WIKI.db
      .select({ id: groupsTable.id, rules: groupsTable.rules })
      .from(groupsTable)
    rulesCache = {}
    for (const row of rows) {
      rulesCache[row.id] = (row.rules ?? []) as GroupRule[]
    }
    WIKI.logger.info(`Loaded page rules for ${rows.length} groups [ OK ]`)
  }

  /** The pooled rules of a set of groups, which is what a permission is decided against. */
  rulesForGroups(groupIds: string[]): GroupRule[] {
    return groupIds.flatMap((id) => rulesCache[id] ?? [])
  }

  /**
   * Which groups a request speaks for.
   *
   * An anonymous request is not group-less: it is the guests group, whose rules are how a wiki says
   * what the public may see. Treating it as no groups at all would deny everything, which is a
   * different answer from the one the administrator configured.
   */
  groupIdsForRequest(req: FastifyRequest): string[] {
    if (req.session?.authenticated && req.session.user?.id) {
      return req.session.groups ?? []
    }
    return [WIKI.data.systemIds.guestsGroupId]
  }

  /** The actor a request speaks for: its groups, and the group-wide permissions it holds. */
  actorForRequest(req: FastifyRequest): AccessActor {
    return {
      groupIds: this.groupIdsForRequest(req),
      // -> An API key stands in for a session and carries its own permissions, as it does in the
      //    route-level check
      permissions: req.apiKey?.permissions ?? req.session?.permissions ?? []
    }
  }

  /**
   * Whether this caller may do this to this page.
   *
   * The one place page permissions are decided. Everything page-scoped asks this rather than reading
   * the session's permission list, because that list says what a group was granted GLOBALLY and page
   * permissions are not granted that way — see `helpers/pageRules.ts` for how a rule is chosen.
   *
   * @param permission A single page permission, e.g. `read:pages` or `read:history`
   */
  checkAccess(actor: AccessActor, permission: string, page: RulePageRef): boolean {
    // -> Above the rules entirely: an administrator is not something a rule can lock out, and a
    //    wiki whose only administrator had denied themselves would have nobody left to fix it
    if (actor.permissions.includes('manage:system')) {
      return true
    }
    const rule = resolvePageRule(this.rulesForGroups(actor.groupIds), permission, page)
    return rule ? rule.mode !== 'DENY' : false
  }
  async init(ids: SystemIds): Promise<void> {
    WIKI.logger.info('Inserting default groups...')

    await WIKI.db.insert(groupsTable).values([
      {
        id: ids.groupAdminId,
        name: 'Administrators',
        permissions: ['manage:system'],
        rules: [],
        isSystem: true
      },
      {
        id: ids.groupUserId,
        name: 'Users',
        permissions: ['read:pages', 'read:assets', 'read:comments'],
        rules: [
          {
            id: uuid(),
            name: 'Default Rule',
            roles: ['read:pages', 'read:assets', 'read:comments'],
            match: 'START',
            mode: 'ALLOW',
            path: '',
            locales: [],
            sites: []
          }
        ],
        isSystem: true
      },
      {
        id: ids.groupGuestId,
        name: 'Guests',
        permissions: ['read:pages', 'read:assets', 'read:comments'],
        rules: [
          {
            id: uuid(),
            name: 'Default Rule',
            roles: ['read:pages', 'read:assets', 'read:comments'],
            match: 'START',
            mode: 'DENY',
            path: '',
            locales: [],
            sites: []
          }
        ],
        isSystem: true
      }
    ])
  }

  /**
   * Create a new (non-system) group, seeded with the same starting permissions and default rule as
   * the `Users` group.
   *
   * @param name Group name
   * @returns The new group's ID
   */
  async createGroup(name: string): Promise<string> {
    const startingPermissions = ['read:pages', 'read:assets', 'read:comments']
    const result = await WIKI.db
      .insert(groupsTable)
      .values({
        name,
        permissions: startingPermissions,
        rules: [
          {
            id: uuid(),
            name: 'Default Rule',
            roles: startingPermissions,
            match: 'START',
            mode: 'ALLOW',
            path: '',
            locales: [],
            sites: []
          }
        ],
        isSystem: false
      })
      .returning({ id: groupsTable.id })
    await this.reloadCache()
    return result[0].id
  }

  /**
   * Fetch all groups, ordered by name
   */
  async getAllGroups(): Promise<GroupWithUserCount[]> {
    const results = await WIKI.db
      .select(groupSelection)
      .from(groupsTable)
      .leftJoin(userGroups, eq(userGroups.groupId, groupsTable.id))
      .groupBy(groupsTable.id)
      .orderBy(groupsTable.name)
    return results as GroupWithUserCount[]
  }

  /**
   * Fetch a single group by ID
   *
   * @param id Group ID
   * @returns The group, or null if no such group exists
   */
  async getGroupById(id: string): Promise<GroupWithUserCount | null> {
    const results = await WIKI.db
      .select(groupSelection)
      .from(groupsTable)
      .leftJoin(userGroups, eq(userGroups.groupId, groupsTable.id))
      .where(eq(groupsTable.id, id))
      .groupBy(groupsTable.id)
      .limit(1)
    return (results[0] as GroupWithUserCount) ?? null
  }

  /**
   * Update a group
   *
   * @param id Group ID
   * @param patch Fields to change — must not be empty
   * @returns Whether a group was updated
   */
  async updateGroup(id: string, patch: GroupPatch): Promise<boolean> {
    const result = await WIKI.db
      .update(groupsTable)
      .set({ ...this.clampGuestPatch(id, patch), updatedAt: sql`now()` })
      .where(eq(groupsTable.id, id))
    await this.reloadCache()
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Hold the guests group to what the public may be given.
   *
   * The guests group is every anonymous reader at once, so a rule on it is a rule about the open
   * internet: writing a page, deleting one, reading its source history — none of those are things to
   * hand out to nobody in particular, and several of them cannot be undone. So the set is fixed here,
   * beside the rules themselves, rather than only in the admin screen that edits them: what a group
   * may hold is not something a browser should be the only one deciding.
   *
   * Roles outside the set are dropped rather than refused. An administrator saving a group edited
   * before this existed — or through the API — gets the group they asked for minus what may not be
   * granted, instead of a form that cannot be saved and does not say which rule is at fault.
   */
  private clampGuestPatch(id: string, patch: GroupPatch): GroupPatch {
    if (id !== WIKI.data.systemIds.guestsGroupId || !patch.rules) {
      return patch
    }
    let dropped = 0
    const rules = patch.rules.map((rule) => {
      const roles = (rule.roles ?? []).filter((role) => GUEST_ROLES.includes(role))
      dropped += (rule.roles ?? []).length - roles.length
      return { ...rule, roles }
    })
    if (dropped > 0) {
      WIKI.logger.warn(
        `Dropped ${dropped} permission(s) from the guests group that may not be granted to it.`
      )
    }
    return { ...patch, rules }
  }

  /**
   * Delete a group. Assignments in `userGroups` are removed by the FK cascade.
   *
   * @param id Group ID
   * @returns Whether a group was deleted
   */
  async deleteGroup(id: string): Promise<boolean> {
    const result = await WIKI.db.delete(groupsTable).where(eq(groupsTable.id, id))
    await this.reloadCache()
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Assign a user to a group. Idempotent.
   *
   * @returns False if the user was already a member
   */
  /**
   * Why this user may not be a member of this group, if they may not.
   *
   * The guests group and the guest account belong to each other and to nothing else:
   *
   *   - the group IS anonymous access, so a real user in it would be granted whatever the public is
   *     granted regardless of their own groups, and would keep it after every other group was taken
   *     away from them;
   *   - the account IS the anonymous visitor, so putting it in another group hands that group's
   *     permissions to everybody who never logged in.
   *
   * The pair is also why neither half can be taken apart: removing the account from the group would
   * leave anonymous access resolving against nothing, with no way back through the interface.
   *
   * One definition, used by the routes that assign a single membership and by `setUserGroups`, which
   * sets them all at once.
   *
   * @returns The reason, or null when the membership is fine
   */
  guestMembershipViolation(groupId: string, user: { isSystem?: boolean } | null): string | null {
    const isGuestsGroup = groupId === WIKI.data.systemIds.guestsGroupId
    // -> The guest account is the only system user; see the seeding in `models/users.ts`
    if (user?.isSystem) {
      return isGuestsGroup
        ? null
        : 'The guest account cannot be a member of any group other than the guests group.'
    }
    return isGuestsGroup
      ? 'The guests group holds the guest account and nothing else — it is what anonymous visitors are.'
      : null
  }

  async assignUserToGroup(groupId: string, userId: string): Promise<boolean> {
    const user = await WIKI.models.users.getById(userId)
    const violation = this.guestMembershipViolation(groupId, user)
    if (violation) {
      throw new CustomError('groupMembershipForbidden', violation)
    }
    const result = await WIKI.db
      .insert(userGroups)
      .values({ userId, groupId })
      .onConflictDoNothing()
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Remove a user from a group
   *
   * @returns False if the user was not a member
   */
  async unassignUserFromGroup(groupId: string, userId: string): Promise<boolean> {
    /*
      The one membership that cannot be taken apart: anonymous access resolves against the guests
      group's rules, and the guest account is what resolves it. Removed, every anonymous visitor would
      hold nothing at all — and nothing in the interface puts a system user back into a group.
    */
    if (groupId === WIKI.data.systemIds.guestsGroupId) {
      const user = await WIKI.models.users.getById(userId)
      if (user?.isSystem) {
        throw new CustomError(
          'groupMembershipForbidden',
          'The guest account cannot be removed from the guests group.'
        )
      }
    }
    const result = await WIKI.db
      .delete(userGroups)
      .where(and(eq(userGroups.groupId, groupId), eq(userGroups.userId, userId)))
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Fetch a page of the users assigned to a group, ordered by name.
   *
   * @param groupId Group ID
   * @param filter Optional case-insensitive substring matched against name and email
   * @param page 1-based page number
   * @param limit Page size
   */
  async getGroupUsers(
    groupId: string,
    { filter = '', page = 1, limit = 20 }: { filter?: string; page?: number; limit?: number } = {}
  ): Promise<GroupUserPage> {
    const conditions = [eq(userGroups.groupId, groupId)]
    if (filter) {
      const pattern = `%${escapeLikePattern(filter)}%`
      conditions.push(or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern))!)
    }
    const where = and(...conditions)

    const totals = await WIKI.db
      .select({ total: count() })
      .from(userGroups)
      .innerJoin(usersTable, eq(usersTable.id, userGroups.userId))
      .where(where)

    const users = await WIKI.db
      .select({
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
      })
      .from(userGroups)
      .innerJoin(usersTable, eq(usersTable.id, userGroups.userId))
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
   * Count the users assigned to a group
   */
  async countUsersInGroup(groupId: string): Promise<number> {
    return WIKI.db.$count(userGroups, eq(userGroups.groupId, groupId))
  }

  /**
   * Whether a user is currently assigned to a group
   */
  async isUserInGroup(groupId: string, userId: string): Promise<boolean> {
    const total = await WIKI.db.$count(
      userGroups,
      and(eq(userGroups.groupId, groupId), eq(userGroups.userId, userId))
    )
    return total > 0
  }
}

export const groups = new Groups()
