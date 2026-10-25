import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  groups as groupsTable,
  pageOwners as ownersTable,
  pages as pagesTable,
  userGroups,
  users as usersTable
} from '../db/schema.ts'
import { CustomError } from '../helpers/common.ts'
import type { GroupLookup } from './groups.ts'
import type { UserLookup } from './users.ts'

/**
 * Who a page is owned by. `creator` is the absence of `pageOwners` rows rather than a value stored
 * anywhere, so it is what every page starts as and what one returns to when its owners are gone.
 */
export const OWNERSHIP_MODES = ['creator', 'users', 'groups'] as const
export type OwnershipMode = (typeof OWNERSHIP_MODES)[number]

/** The most owners one page may name. */
export const MAX_PAGE_OWNERS = 50

/**
 * A page's owners, as the properties panel draws them. One of the two lists is always empty — a page
 * is owned by some users or by some groups — and both are when the page is its creator's.
 */
export interface PageOwnership {
  mode: OwnershipMode
  users: UserLookup[]
  groups: GroupLookup[]
}

/**
 * Page owners model
 *
 * Who answers for a page. A label for now: nothing is granted to an owner, and the reason it is kept
 * at all is to know whom to ask when a page needs looking after. Not page content, so a change of
 * owners records no version and is not in one (see `pageOwners` in `db/schema.ts`).
 */
class PageOwners {
  /**
   * A page's owners, with what a picker shows of each.
   *
   * An owner who can no longer be offered -- an account since disabled -- is left out rather than
   * shown, and a page left with none that can is its creator's, which is what no owner means. The
   * row stays, so re-enabling the account makes them an owner again.
   */
  async ownershipOf(pageId: string): Promise<PageOwnership> {
    const rows = await WIKI.db
      .select({
        userId: usersTable.id,
        userName: usersTable.name,
        userHandle: usersTable.handle,
        userHasAvatar: usersTable.hasAvatar,
        groupId: groupsTable.id,
        groupName: groupsTable.name
      })
      .from(ownersTable)
      .leftJoin(
        usersTable,
        and(
          eq(usersTable.id, ownersTable.userId),
          eq(usersTable.isActive, true),
          eq(usersTable.isSystem, false)
        )
      )
      .leftJoin(groupsTable, eq(groupsTable.id, ownersTable.groupId))
      .where(eq(ownersTable.pageId, pageId))
      .orderBy(sql`coalesce(${usersTable.name}, ${groupsTable.name})`)

    const users: UserLookup[] = []
    const groups: GroupLookup[] = []
    for (const row of rows) {
      if (row.userId) {
        users.push({
          id: row.userId,
          name: row.userName ?? '',
          handle: row.userHandle ?? '',
          hasAvatar: row.userHasAvatar ?? false
        })
      } else if (row.groupId) {
        groups.push({ id: row.groupId, name: row.groupName ?? '' })
      }
    }
    return {
      mode: users.length > 0 ? 'users' : groups.length > 0 ? 'groups' : 'creator',
      users,
      groups
    }
  }

  /**
   * Whether this user is one of the page's owners: named among its users, in one of its groups, or
   * its creator when it names nobody.
   */
  async isOwner(page: { id: string; creatorId: string }, userId: string | null): Promise<boolean> {
    if (!userId) {
      return false
    }
    const { mode, users, groups } = await this.ownershipOf(page.id)
    if (mode === 'creator') {
      return page.creatorId === userId
    }
    if (mode === 'users') {
      return users.some((user) => user.id === userId)
    }
    const member = await WIKI.db
      .select({ groupId: userGroups.groupId })
      .from(userGroups)
      .where(
        and(
          eq(userGroups.userId, userId),
          inArray(
            userGroups.groupId,
            groups.map((group) => group.id)
          )
        )
      )
      .limit(1)
    return member.length > 0
  }

  /**
   * Replace a page's owners.
   *
   * `creator`, or either of the others with no ids, takes every owner off: the page is then its
   * creator's. Each id has to be somebody `users.lookup` or `groups.lookup` would offer, so an
   * owner is never a disabled account, the guest account or the guests group.
   *
   * Says nothing about whether the CALLER may name these owners: that is a question about the
   * request, answered by the route.
   *
   * @returns The page's owners as they now stand
   */
  async setOwnership(pageId: string, mode: OwnershipMode, ids: string[]): Promise<PageOwnership> {
    const wanted = mode === 'creator' ? [] : [...new Set(ids)]
    if (wanted.length > MAX_PAGE_OWNERS) {
      throw new CustomError(
        'pageOwnersTooMany',
        `A page may have at most ${MAX_PAGE_OWNERS} owners.`
      )
    }
    if (wanted.length > 0) {
      const lookup = { ids: wanted, limit: wanted.length }
      const found =
        mode === 'users'
          ? await WIKI.models.users.lookup(lookup)
          : await WIKI.models.groups.lookup(lookup)
      if (found.length !== wanted.length) {
        throw new CustomError(
          'pageOwnerInvalid',
          mode === 'users'
            ? 'Every owner must be an active user.'
            : 'Every owner must be a group other than Guests.'
        )
      }
    }

    await WIKI.db.transaction(async (tx) => {
      // -> Two saves of the same page's owners at once would otherwise both delete, then both insert
      //    and collide on the unique index; the page row is what they queue on
      await tx
        .select({ id: pagesTable.id })
        .from(pagesTable)
        .where(eq(pagesTable.id, pageId))
        .for('update')
      await tx.delete(ownersTable).where(eq(ownersTable.pageId, pageId))
      if (wanted.length > 0) {
        await tx
          .insert(ownersTable)
          .values(
            wanted.map((id) =>
              mode === 'users' ? { pageId, userId: id } : { pageId, groupId: id }
            )
          )
      }
    })
    return this.ownershipOf(pageId)
  }
}

export const pageOwners = new PageOwners()
