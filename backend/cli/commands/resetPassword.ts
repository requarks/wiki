import { randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import chalk from 'chalk'
import { personalTokens as personalTokensTable } from '../../db/schema.ts'
import { CliError, describeUser, findUser } from '../runtime.ts'
import type { CliContext, Command } from '../runtime.ts'
import { adminAccounts, printAdmins } from './listAdmins.ts'
import { defaultSiteId } from './sites.ts'

/** No 0/O, 1/l/I: the password is read off a screen and typed in by hand. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/**
 * Four groups of five, about 116 bits. Grouped because it is read aloud or copied by eye as often as
 * it is pasted; the dashes are part of the password.
 */
function generatePassword(): string {
  const groups: string[] = []
  for (let g = 0; g < 4; g++) {
    let group = ''
    for (let i = 0; i < 5; i++) {
      group += ALPHABET[randomInt(ALPHABET.length)]
    }
    groups.push(group)
  }
  return groups.join('-')
}

/**
 * Tell the account holder. Sent on every reset whenever mail is configured, with no option to skip
 * it: the CLI hands an account to whoever can run it, and this mail is how the owner finds out when
 * that was somebody who should not have.
 *
 * Best-effort all the same: the reset has happened whether or not the mail goes out, so a failure
 * here is reported and nothing else.
 */
async function notify(
  ctx: CliContext,
  user: { email: string; name: string; prefs: unknown },
  data: { secondFactorsRemoved: boolean; tokensRevoked: boolean }
): Promise<void> {
  const siteId = defaultSiteId()
  const baseUrl = siteId ? WIKI.models.mail.baseUrl({ siteId }) : null
  try {
    // -> The translator reads the installed locales from a cache an instance fills at boot
    await WIKI.models.locales.reloadCache()
    await WIKI.models.mail.send({
      site: WIKI.models.mail.siteFor(siteId ?? '', baseUrl),
      to: user.email,
      template: 'adminPasswordReset',
      locale: (user.prefs as Record<string, any>)?.locale,
      data: { name: user.name, baseUrl, ...data }
    })
    ctx.success(`Emailed ${user.email} to say the password was reset.`)
  } catch (err: any) {
    ctx.warn(`Could not email ${user.email}: ${err.message}`)
  }
}

export const resetPassword: Command = {
  name: 'reset-password',
  summary: 'Give an account a new random password, removing 2FA and passkeys',
  description:
    'Generates a password, shows it once, and requires it to be changed at the next sign-in. ' +
    'Turns password sign-in back on, removes two-factor authentication and every passkey, and ' +
    'signs the account out everywhere. Optionally revokes its personal access tokens. When mail is ' +
    'configured, the account holder is emailed to say it happened.',
  options: {
    email: {
      type: 'string',
      short: 'e',
      placeholder: 'address',
      description: 'Email address of the account'
    },
    'keep-tokens': {
      type: 'boolean',
      description: 'Leave personal access tokens alone instead of asking (default: revoke)'
    }
  },
  async run(ctx, values) {
    let email = values.email as string | undefined
    if (!email && ctx.interactive) {
      ctx.heading('Administrators (manage:system)')
      printAdmins(ctx, await adminAccounts())
      ctx.line()
    }
    email ??= await ctx.ask('Email address of the account to reset:', 'email')
    const user = await findUser(email)

    const groups = await WIKI.models.users.getUserGroups(user.id)
    const elevated = await WIKI.models.groups.elevatedGroupIds()
    const auth = (user.auth ?? {}) as Record<string, any>
    const local = auth[WIKI.data.systemIds.localAuthId]
    const tfaActive = Object.values(auth).some((config: any) => config?.tfaIsActive)
    const passkeyCount = (((user.passkeys ?? {}) as Record<string, any>).authenticators ?? [])
      .length
    const tokenCount = await WIKI.db.$count(
      personalTokensTable,
      eq(personalTokensTable.userId, user.id)
    )

    ctx.heading(describeUser(user))
    ctx.line(
      `  Groups: ${
        groups
          .map((group) => (elevated.includes(group.id) ? chalk.bold(group.name) : group.name))
          .join(', ') || chalk.dim('none')
      }`
    )
    ctx.line(
      `  Status: ${user.isActive ? 'active' : chalk.red('disabled')}, ${user.isVerified ? 'verified' : chalk.yellow('unverified')}`
    )

    ctx.heading('This will:')
    ctx.line(`  - replace the password with a random one, to be changed at the next sign-in`)
    if (!local) {
      ctx.line(
        '  - give the account a password for the first time (it signs in through a provider)'
      )
    }
    if (local?.restrictLogin) {
      ctx.line('  - turn password sign-in back on for this account')
    }
    ctx.line('  - sign the account out everywhere')
    if (tfaActive) {
      ctx.warn(
        'Two-factor authentication will be turned off. If a group or strategy requires it, the account will be made to set it up again at sign-in.'
      )
    }
    if (passkeyCount > 0) {
      ctx.warn(`All ${passkeyCount} passkey(s) registered to this account will be removed.`)
    }
    if (!user.isActive) {
      ctx.warn(
        'The account is disabled, so the new password will not let anyone in until it is enabled again (enable-user).'
      )
    }

    const revokeTokens =
      tokenCount > 0 && !values['keep-tokens']
        ? await ctx.choose(`Also revoke its ${tokenCount} personal access token(s)?`, true)
        : false
    const sendMail = WIKI.models.mail.isConfigured
    ctx.line(
      sendMail
        ? `  - email ${user.email} to say the password was reset`
        : chalk.dim('  Mail is not configured, so the account holder will not be told.')
    )

    await ctx.confirmWrite(`Reset the password for ${user.email}?`)

    const newPassword = generatePassword()
    const result = await WIKI.models.users.recoverAccount({ id: user.id, newPassword })
    if (!result) {
      throw new CliError('The account disappeared before it could be reset.')
    }
    const tokensRevoked = revokeTokens
      ? await WIKI.models.personalTokens.removeAllForUser(user.id)
      : 0

    await ctx.audit('admin', 'resetUserPassword', {
      targetUserId: user.id,
      tfaDisabled: result.tfaDisabled,
      passkeysRemoved: result.passkeysRemoved,
      // -> Not `tokensRevoked`: `sanitizeMeta` takes any key containing "token" for a secret
      patsRevoked: tokensRevoked
    })

    ctx.line()
    ctx.success(`Password reset for ${user.email}. Every session it held has been ended.`)
    if (result.tfaDisabled) {
      ctx.success('Two-factor authentication turned off.')
    }
    if (result.passkeysRemoved > 0) {
      ctx.success(`${result.passkeysRemoved} passkey(s) removed.`)
    }
    if (tokensRevoked > 0) {
      ctx.success(`${tokensRevoked} personal access token(s) revoked.`)
    }
    if (sendMail) {
      await notify(ctx, user, {
        secondFactorsRemoved: result.tfaDisabled || result.passkeysRemoved > 0,
        tokensRevoked: tokensRevoked > 0
      })
    }

    ctx.line()
    ctx.line(`  New password:  ${chalk.bold.inverse(` ${newPassword} `)}`)
    ctx.line()
    ctx.line(
      chalk.dim('  Shown once and stored nowhere else. It must be changed at the next sign-in.')
    )
  }
}
