import chalk from 'chalk'
import { CliError, describeUser, findUser } from '../runtime.ts'
import type { CliContext, Command } from '../runtime.ts'

/**
 * Make a group carrying `manage:system`, for an instance that has none left — every administrator
 * group deleted or stripped of it. Named "Administrators" like the seeded one, or with a suffix when
 * a group by that name still exists without the permission (which is the more likely way to get
 * here, and leaves it alone rather than quietly re-arming it).
 */
async function createAdminGroup(ctx: CliContext): Promise<{ id: string; name: string }> {
  // -> Loaded here rather than at the top: every command module is imported before `WIKI` exists
  const { SYSTEM_PERMISSION } = await import('../../models/groups.ts')
  let name = 'Administrators'
  if (await WIKI.models.groups.validateName(name)) {
    name = 'Administrators (recovered)'
  }
  if (await WIKI.models.groups.validateName(name)) {
    name = `Administrators (recovered ${Temporal.Now.plainDateISO('UTC').toString()})`
  }
  const id = await WIKI.models.groups.createGroup(name)
  await WIKI.models.groups.updateGroup(id, { permissions: [SYSTEM_PERMISSION] })
  await ctx.audit('admin', 'createGroup', { groupId: id, groupName: name })
  await ctx.audit('admin', 'updateGroup', { groupId: id, permissions: [SYSTEM_PERMISSION] })
  ctx.success(`Created the group "${name}" with manage:system.`)
  return { id, name }
}

export const grantAdmin: Command = {
  name: 'grant-admin',
  summary: 'Add an account to a group that holds manage:system',
  description:
    'For when no usable administrator is left. When more than one group holds manage:system, ' +
    'choose which; when none does, offers to create one. The account is signed out so that its ' +
    'next sign-in picks the new permissions up.',
  options: {
    email: {
      type: 'string',
      short: 'e',
      placeholder: 'address',
      description: 'Email address of the account'
    },
    group: {
      type: 'string',
      short: 'g',
      placeholder: 'id|name',
      description: 'The group to add it to, when more than one holds manage:system'
    }
  },
  async run(ctx, values) {
    const user = await findUser(
      (values.email as string | undefined) ??
        (await ctx.ask('Email address of the account to make an administrator:', 'email'))
    )

    const groupIds = await WIKI.models.groups.systemGroupIds()
    const adminGroups = (await WIKI.models.groups.getAllGroups()).filter((group) =>
      groupIds.includes(group.id)
    )
    const current = await WIKI.models.users.getUserGroupIds(user.id)
    const already = adminGroups.find((group) => current.includes(group.id))
    if (already) {
      ctx.success(`${describeUser(user)} is already an administrator, through "${already.name}".`)
      if (!user.isActive) {
        ctx.warn('The account is disabled, though: enable-user turns it back on.')
      }
      return
    }

    let target: { id: string; name: string } | null = null
    if (values.group) {
      const wanted = String(values.group).trim().toLowerCase()
      target = adminGroups.find((g) => g.id === wanted || g.name.toLowerCase() === wanted) ?? null
      if (!target) {
        throw new CliError(`No group holding manage:system has the ID or name ${values.group}.`)
      }
    } else if (adminGroups.length === 1) {
      target = adminGroups[0]!
    } else if (adminGroups.length > 1) {
      ctx.heading('Groups holding manage:system')
      target = await ctx.pick(
        'Which group?',
        adminGroups,
        (group) => `${group.name} ${chalk.dim(`(${group.userCount} member(s))`)}`,
        'group'
      )
    }

    ctx.heading(describeUser(user))
    if (target) {
      ctx.line(`  Will be added to "${target.name}", and signed out everywhere.`)
    } else {
      ctx.warn('No group holds manage:system.')
      ctx.line(
        '  A group named "Administrators" holding it will be created, and the account added.'
      )
    }
    if (!user.isActive) {
      ctx.warn('The account is disabled: run enable-user as well, or it still cannot sign in.')
    }

    await ctx.confirmWrite(`Make ${user.email} an administrator?`)

    target ??= await createAdminGroup(ctx)
    await WIKI.models.groups.assignUserToGroup(target.id, user.id)
    await ctx.audit('admin', 'assignUserToGroup', {
      groupId: target.id,
      groupName: target.name,
      targetUserId: user.id
    })
    ctx.line()
    ctx.success(
      `${user.email} is now in "${target.name}", and holds manage:system from its next sign-in.`
    )
  }
}

export const enableUser: Command = {
  name: 'enable-user',
  summary: 'Re-enable a disabled account and turn its password sign-in back on',
  description:
    'Marks the account active and its email address verified, and turns password sign-in back on ' +
    'if it was turned off for the account. Does not touch the password itself: use reset-password ' +
    'for that.',
  options: {
    email: {
      type: 'string',
      short: 'e',
      placeholder: 'address',
      description: 'Email address of the account'
    }
  },
  async run(ctx, values) {
    const user = await findUser(
      (values.email as string | undefined) ??
        (await ctx.ask('Email address of the account to enable:', 'email'))
    )
    const local = ((user.auth ?? {}) as Record<string, any>)[WIKI.data.systemIds.localAuthId]
    const changes = [
      ...(!user.isActive ? ['enable the account'] : []),
      ...(!user.isVerified ? ['mark its email address verified'] : []),
      ...(local?.restrictLogin ? ['turn password sign-in back on'] : [])
    ]

    ctx.heading(describeUser(user))
    if (changes.length < 1) {
      ctx.success('The account is already active, verified and allowed to sign in with a password.')
      if (!local?.password) {
        ctx.line('  It has no password: reset-password gives it one.')
      }
      return
    }
    ctx.line('This will:')
    for (const change of changes) {
      ctx.line(`  - ${change}`)
    }
    if (!local?.password) {
      ctx.warn('The account has no password: run reset-password to give it one.')
    }

    await ctx.confirmWrite(`Enable ${user.email}?`)

    await WIKI.models.users.updateUser(user.id, { isActive: true, isVerified: true })
    if (local?.restrictLogin) {
      await WIKI.models.users.setUserAuthFlags(user.id, { restrictLogin: false })
    }
    await ctx.audit('admin', 'updateUser', {
      targetUserId: user.id,
      isActive: true,
      isVerified: true,
      ...(local?.restrictLogin ? { restrictLogin: false } : {})
    })
    ctx.line()
    ctx.success(`${user.email} can sign in again.`)
  }
}
