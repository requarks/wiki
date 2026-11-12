import chalk from 'chalk'
import { sql } from 'drizzle-orm'
import type { Command } from '../runtime.ts'

/**
 * The instances connected to this database right now, by the `application_name` each one's main
 * pool connects with (`core/db.ts`). There is no registry of instances; this is the closest thing,
 * and it is exact for as long as they are up.
 *
 * Postgres shows another role's sessions to a role without `pg_read_all_stats` with most columns
 * blanked, but the application name is not one of them.
 */
export async function connectedInstances(): Promise<
  Array<{ id: string; address: string; since: string }>
> {
  const rows = await WIKI.db.execute(sql`
    SELECT substring(application_name FROM '^Wiki[.]js - (.+):MAIN$') AS id,
           min(host(client_addr)) AS address,
           to_char(min(backend_start) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC' AS since
    FROM pg_stat_activity
    WHERE datname = current_database() AND application_name ~ '^Wiki[.]js - .+:MAIN$'
    GROUP BY 1
    ORDER BY min(backend_start)
  `)
  return rows.rows.map((row: any) => ({
    id: String(row.id),
    address: row.address ? String(row.address) : 'local socket',
    since: String(row.since ?? '')
  }))
}

export const resetSecurity: Command = {
  name: 'reset-security',
  summary: 'Turn off the Content Security Policy and reset CORS',
  description:
    'For a wiki whose interface no longer loads because of a Content Security Policy or CORS ' +
    'setting. Turns CSP enforcement off (keeping the directives, to fix and turn back on) and sets ' +
    'CORS back to its default. Instances read these when they start, so restart them afterwards.',
  options: {},
  async run(ctx) {
    const security = WIKI.config.security ?? {}
    ctx.heading('Security headers')
    ctx.line(`  Content Security Policy: ${security.enforceCsp ? chalk.yellow('enforced') : 'off'}`)
    ctx.line(`  CORS mode: ${security.corsMode}`)
    if (security.enforceHsts) {
      ctx.line(
        chalk.dim(
          '  HSTS is on and is left alone: browsers remember it for its full duration whatever the server says next.'
        )
      )
    }
    if (!security.enforceCsp && security.corsMode === 'OFF') {
      ctx.success('Nothing to reset: CSP is not enforced and CORS is at its default.')
      return
    }

    await ctx.confirmWrite('Turn CSP enforcement off and reset CORS?')

    WIKI.config.security = { ...security, enforceCsp: false, corsMode: 'OFF' }
    // -> Emits `reloadConfig`, which `cli.ts` forwards to the running instances
    if (!(await WIKI.configSvc.saveToDb(['security']))) {
      throw new Error('The settings could not be saved.')
    }
    await ctx.audit('admin', 'updateSecurity', { enforceCsp: false, corsMode: 'OFF' })
    ctx.line()
    ctx.success(
      'Saved. Restart every instance for the headers to change: they are set up as the server starts.'
    )
  }
}

export const flushCaches: Command = {
  name: 'flush-caches',
  summary: 'Tell every running instance to drop its caches',
  description:
    'The same as Admin → Utilities → Flush Caches, without the admin area: every instance throws ' +
    'away what it holds that the database is the real copy of, and reads it back. Nothing is lost.',
  options: {},
  async run(ctx) {
    const instances = await connectedInstances()
    if (instances.length < 1) {
      ctx.warn('No running instance is connected to this database, so there is nothing to flush.')
      return
    }
    await ctx.broadcast('flushCaches')
    await ctx.audit('admin', 'flushCache', {})
    ctx.success(`Asked ${instances.length} running instance(s) to flush their caches.`)
  }
}
