import { and, eq, inArray } from 'drizzle-orm'
import chalk from 'chalk'
import { groups as groupsTable, userGroups, users as usersTable } from '../../db/schema.ts'
import type { CliContext, Command } from '../runtime.ts'

export interface AdminAccount {
  id: string
  name: string
  email: string
  isActive: boolean
  isVerified: boolean
  lastLoginAt: Date | null
  groups: string[]
}

/**
 * Every account in a group carrying `manage:system`, one row per account however many such groups
 * it is in.
 */
export async function adminAccounts(): Promise<AdminAccount[]> {
  const groupIds = await WIKI.models.groups.systemGroupIds()
  if (groupIds.length < 1) {
    return []
  }
  const rows = await WIKI.db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      isActive: usersTable.isActive,
      isVerified: usersTable.isVerified,
      lastLoginAt: usersTable.lastLoginAt,
      groupName: groupsTable.name
    })
    .from(usersTable)
    .innerJoin(userGroups, eq(userGroups.userId, usersTable.id))
    .innerJoin(groupsTable, eq(groupsTable.id, userGroups.groupId))
    .where(and(inArray(userGroups.groupId, groupIds), eq(usersTable.isSystem, false)))
    .orderBy(usersTable.email, groupsTable.name)

  const accounts = new Map<string, AdminAccount>()
  for (const { groupName, ...row } of rows) {
    const account = accounts.get(row.id) ?? { ...row, groups: [] }
    account.groups.push(groupName)
    accounts.set(row.id, account)
  }
  return [...accounts.values()]
}

/** The administrators as a table, or a pointer to `grant-admin` when there are none. */
export function printAdmins(ctx: CliContext, accounts: AdminAccount[]): void {
  if (accounts.length < 1) {
    ctx.warn('No account holds manage:system. Use grant-admin to give one back.')
    return
  }
  ctx.table(
    [
      { key: 'email', title: 'Email' },
      { key: 'name', title: 'Name' },
      { key: 'status', title: 'Status' },
      { key: 'lastLogin', title: 'Last login' },
      { key: 'groups', title: 'Groups' }
    ],
    accounts.map((account) => ({
      email: account.email,
      name: account.name,
      status: !account.isActive
        ? chalk.red('disabled')
        : !account.isVerified
          ? chalk.yellow('unverified')
          : chalk.green('active'),
      lastLogin: account.lastLoginAt
        ? account.lastLoginAt
            .toTemporalInstant()
            .toString({ smallestUnit: 'minute' })
            .replace('T', ' ')
            .replace('Z', ' UTC')
        : chalk.dim('never'),
      groups: account.groups.join(', ')
    }))
  )
}

export const listAdmins: Command = {
  name: 'list-admins',
  summary: 'List the accounts that hold manage:system',
  options: {},
  async run(ctx) {
    ctx.heading('Administrators (manage:system)')
    printAdmins(ctx, await adminAccounts())
  }
}
