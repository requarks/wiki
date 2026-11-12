import { sql } from 'drizzle-orm'
import chalk from 'chalk'
import { users as usersTable } from '../../db/schema.ts'
import { CliError } from '../runtime.ts'
import type { Command } from '../runtime.ts'

/** What `POST /sites` accepts as a hostname (`api/sites.ts`): a bare host, or `*` for any. */
const HOSTNAME_PATTERN = /^(\*|[a-z0-9.-]+)$/

/**
 * The site a mail about no site in particular is written for: the only one, else the catch-all,
 * else the first enabled one by hostname. Read from `WIKI.sites`, which `cli.ts` fills at boot.
 */
export function defaultSiteId(): string | null {
  const sites = Object.values(WIKI.sites).toSorted((a, b) => a.hostname.localeCompare(b.hostname))
  if (sites.length === 1) {
    return sites[0].id
  }
  return (
    sites.find((site) => site.hostname === '*')?.id ??
    sites.find((site) => site.isEnabled)?.id ??
    sites[0]?.id ??
    null
  )
}

function siteLabel(site: { hostname: string; isEnabled: boolean; config: any }): string {
  return `${site.hostname.padEnd(32)} ${site.config?.title ?? ''}${site.isEnabled ? '' : chalk.dim(' (disabled)')}`
}

export const setHostname: Command = {
  name: 'set-hostname',
  summary: 'Change the hostname a site answers to',
  description:
    'Lists the sites to choose from, then sets the hostname the chosen one is served on: a bare ' +
    'hostname such as wiki.example.org, or * to answer any hostname no other site claims. Running ' +
    'instances pick the change up straight away.',
  options: {
    site: {
      type: 'string',
      short: 's',
      placeholder: 'id|hostname',
      description: 'The site to change, by its ID or current hostname'
    },
    hostname: {
      type: 'string',
      short: 'n',
      placeholder: 'hostname',
      description: 'The new hostname, or * for any'
    }
  },
  async run(ctx, values) {
    const sites = await WIKI.models.sites.getAllSites()
    let site
    if (values.site) {
      const wanted = String(values.site).trim().toLowerCase()
      site = sites.find((s) => s.id === wanted || s.hostname === wanted)
      if (!site) {
        throw new CliError(`There is no site with the ID or hostname ${values.site}.`)
      }
    } else {
      ctx.heading('Sites')
      site = await ctx.pick('Which site?', sites, siteLabel, 'site')
    }

    const hostname = String(
      values.hostname ??
        (await ctx.ask(`New hostname for ${site.hostname} (or * for any):`, 'hostname'))
    )
      .trim()
      .toLowerCase()
    if (hostname.length > 255 || !HOSTNAME_PATTERN.test(hostname)) {
      throw new CliError(
        `"${hostname}" is not a hostname: use letters, digits, dots and hyphens only (no scheme, port or path), or * for any.`
      )
    }
    if (hostname === site.hostname) {
      throw new CliError(`The site is already served on ${hostname}.`)
    }
    const clash = sites.find((s) => s.hostname === hostname)
    if (clash) {
      throw new CliError(
        `${hostname} already belongs to another site (${(clash.config as Record<string, any>)?.title || clash.id}). Change that one first.`
      )
    }

    const title = (site.config as Record<string, any>)?.title || site.id
    ctx.heading(`${title}: ${site.hostname} → ${hostname}`)
    if (hostname === '*') {
      ctx.line('  The site will answer every hostname that no other site claims.')
    }
    if (!site.isEnabled) {
      ctx.warn(
        'The site is disabled, so it will not be served on the new hostname until it is enabled.'
      )
    }

    // -> A passkey is bound to the hostname it was registered on unless a shared RP ID says otherwise
    if (!WIKI.config.auth?.passkeyRpId && WIKI.models.authentication.arePasskeysAllowed()) {
      const withPasskeys = await WIKI.db.$count(
        usersTable,
        sql`jsonb_array_length(coalesce(${usersTable.passkeys}->'authenticators', '[]'::jsonb)) > 0`
      )
      if (withPasskeys > 0) {
        ctx.warn(
          `Passkeys are bound to the hostname they were registered on. Those registered on ${site.hostname} (up to ${withPasskeys} account(s) have some) will stop working on ${hostname}.`
        )
      }
    }
    ctx.warn(
      'Sign-in providers (OIDC, SAML, OAuth) that redirect back to this site need the new hostname in their allowed callback URLs.'
    )
    const mailBase = String(WIKI.config.mail?.defaultBaseURL ?? '')
    if (site.hostname !== '*' && mailBase.includes(site.hostname)) {
      ctx.warn(
        `Links in emails still point at ${mailBase}: change the base URL under Admin → Mail.`
      )
    }

    await ctx.confirmWrite(`Serve this site on ${hostname}?`)

    if (!(await WIKI.models.sites.updateSite(site.id, { hostname }))) {
      throw new CliError('The site disappeared before it could be changed.')
    }
    await ctx.audit('admin', 'updateSite', {
      siteId: site.id,
      hostname,
      previousHostname: site.hostname
    })
    ctx.line()
    ctx.success(`${title} is now served on ${hostname}.`)
  }
}
