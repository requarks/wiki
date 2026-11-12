import path from 'node:path'
import chalk from 'chalk'
import { and, eq, gte } from 'drizzle-orm'
import {
  jobHistory as jobHistoryTable,
  jobs as jobsTable,
  users as usersTable
} from '../../db/schema.ts'
import { describeDatabase } from '../runtime.ts'
import type { CliContext, Command } from '../runtime.ts'
import { adminAccounts } from './listAdmins.ts'
import { connectedInstances } from './maintenance.ts'

function field(ctx: CliContext, label: string, value: string): void {
  ctx.line(`  ${chalk.dim(label.padEnd(18))} ${value}`)
}

export const info: Command = {
  name: 'info',
  summary: 'Show versions, database, instances, sites and scheduler health (read-only)',
  options: {},
  toleratesSchemaMismatch: true,
  async run(ctx) {
    const schema = ctx.schema

    ctx.heading('Installation')
    field(ctx, 'Wiki.js', WIKI.version)
    field(ctx, 'Node.js', process.version)
    field(
      ctx,
      'Config file',
      process.env.CONFIG_FILE
        ? path.resolve(WIKI.ROOTPATH, process.env.CONFIG_FILE)
        : path.join(WIKI.ROOTPATH, 'config.yml')
    )
    field(ctx, 'Database', describeDatabase())
    field(ctx, 'PostgreSQL', WIKI.dbManager.VERSION ?? '?')
    field(
      ctx,
      'Migrations',
      schema.problem
        ? chalk.red(schema.problem)
        : `${schema.applied.length} applied, up to date (${schema.applied.at(-1) ?? 'none'})`
    )
    if (schema.problem) {
      ctx.line()
      ctx.warn('Stopping here: the rest is read through models written for a different schema.')
      return
    }

    ctx.heading('Running instances')
    const instances = await connectedInstances()
    if (instances.length < 1) {
      ctx.line(chalk.dim('  None connected to this database.'))
    } else {
      ctx.table(
        [
          { key: 'id', title: 'Instance' },
          { key: 'address', title: 'Address' },
          { key: 'since', title: 'Connected since' }
        ],
        instances
      )
    }

    ctx.heading('Sites')
    const sites = await WIKI.models.sites.getAllSites()
    ctx.table(
      [
        { key: 'hostname', title: 'Hostname' },
        { key: 'title', title: 'Title' },
        { key: 'status', title: 'Status' },
        { key: 'id', title: 'ID' }
      ],
      sites.map((site) => ({
        hostname: site.hostname,
        title: (site.config as Record<string, any>)?.title ?? '',
        status: site.isEnabled ? 'enabled' : chalk.dim('disabled'),
        id: chalk.dim(site.id)
      }))
    )

    ctx.heading('Accounts')
    const total = await WIKI.db.$count(usersTable, eq(usersTable.isSystem, false))
    const active = await WIKI.db.$count(
      usersTable,
      and(eq(usersTable.isSystem, false), eq(usersTable.isActive, true))
    )
    const admins = await adminAccounts()
    field(ctx, 'Accounts', `${total} (${active} active)`)
    field(
      ctx,
      'Administrators',
      admins.length > 0
        ? `${admins.length} (${admins.filter((a) => a.isActive).length} active) — see list-admins`
        : chalk.red('none — see grant-admin')
    )
    field(ctx, 'Mail', WIKI.models.mail.isConfigured ? 'configured' : chalk.dim('not configured'))

    ctx.heading('Scheduler')
    const healthy = await WIKI.models.jobs.isHealthy()
    const since = new Date(Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds)
    const failed = await WIKI.db.$count(
      jobHistoryTable,
      and(eq(jobHistoryTable.state, 'failed'), gte(jobHistoryTable.startedAt, since))
    )
    field(
      ctx,
      'Scheduled checks',
      healthy
        ? chalk.green('running')
        : chalk.red('stalled — no instance has checked the schedule lately')
    )
    field(ctx, 'Active jobs', String(await WIKI.models.jobs.countActive()))
    field(ctx, 'Queued jobs', String(await WIKI.db.$count(jobsTable)))
    field(ctx, 'Failed (24h)', failed > 0 ? chalk.yellow(String(failed)) : '0')
  }
}
