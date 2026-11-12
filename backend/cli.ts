#!/usr/bin/env -S node --no-experimental-webstorage
// ===========================================
// Wiki.js Management CLI
// Licensed under AGPLv3
// ===========================================

/**
 * Maintenance and recovery from the server's own shell: what an administrator needs when the admin
 * area is out of reach — a lost password, a site moved to a hostname nobody can reach, a security
 * header that stops the interface loading.
 *
 * It reads the configuration exactly as the server does (`config.yml`, `CONFIG_FILE`, `DATABASE_URL`,
 * `DB_PASS_FILE` and the rest, through `core/config.ts`) and talks to the same database, but it is not
 * a server: no HTTP, no scheduler, no migrations — `dbManager.init(true)` is the worker-thread path,
 * which neither migrates nor honours `dev.dropSchema`. It refuses a database whose schema is not the
 * one this checkout was written for (`checkSchema`), since only a running instance migrates.
 *
 * **It stands outside the permission model on purpose.** Whoever can run it can read the config and
 * so the database credentials, and could do all of this with `psql`; the boundary is shell access to
 * the host or container, and nothing here may be reachable any other way — no route, no job, nothing
 * the admin terminal can start. What it does is recorded in the audit log under the OS user and host.
 *
 * Run from anywhere: the paths are taken from this file's location rather than the working directory.
 *
 *   backend/cli.ts <command> [options]
 *   node --no-experimental-webstorage backend/cli.ts <command> [options]
 */

import path from 'node:path'
import { parseArgs } from 'node:util'
import chalk from 'chalk'
import Emittery from 'emittery'
import NodeCache from 'node-cache'
import semver from 'semver'

import { CliError, checkSchema, createContext } from './cli/runtime.ts'
import type { Command, CommandOption } from './cli/runtime.ts'
import { enableUser, grantAdmin } from './cli/commands/accounts.ts'
import { info } from './cli/commands/info.ts'
import { listAdmins } from './cli/commands/listAdmins.ts'
import { flushCaches, resetSecurity } from './cli/commands/maintenance.ts'
import { resetPassword } from './cli/commands/resetPassword.ts'
import { setHostname } from './cli/commands/sites.ts'

const COMMANDS: Command[] = [
  resetPassword,
  setHostname,
  listAdmins,
  grantAdmin,
  enableUser,
  resetSecurity,
  flushCaches,
  info
]

/** Accepted by every command. */
const GLOBAL_OPTIONS: Record<string, CommandOption> = {
  yes: {
    type: 'boolean',
    short: 'y',
    description: 'Confirm without asking, and take the default answer to every question'
  },
  verbose: {
    type: 'boolean',
    short: 'v',
    description: "Show the server's own log lines while the command runs"
  },
  help: { type: 'boolean', short: 'h', description: 'Show help' }
}

const BIN = 'backend/cli.ts'

function optionLines(options: Record<string, CommandOption>): string[] {
  const entries = Object.entries(options).map(([name, opt]) => {
    const flag = `${opt.short ? `-${opt.short}, ` : '    '}--${name}${opt.type === 'string' ? ` <${opt.placeholder ?? 'value'}>` : ''}`
    return [flag, opt.description] as const
  })
  const width = Math.max(...entries.map(([flag]) => flag.length))
  return entries.map(([flag, description]) => `  ${flag.padEnd(width)}  ${description}`)
}

function printHelp(): void {
  const width = Math.max(...COMMANDS.map((cmd) => cmd.name.length))
  console.log(`${chalk.bold('Wiki.js management CLI')}

Maintenance and recovery for this installation. Reads the same configuration as the server
(config.yml, or CONFIG_FILE, plus environment variables) and changes the database directly.

${chalk.bold('Usage:')} ${BIN} <command> [options]

${chalk.bold('Commands:')}
${COMMANDS.map((cmd) => `  ${cmd.name.padEnd(width)}  ${cmd.summary}`).join('\n')}

${chalk.bold('Options:')}
${optionLines(GLOBAL_OPTIONS).join('\n')}

Run ${BIN} <command> --help for a command's own options.`)
}

function printCommandHelp(cmd: Command): void {
  console.log(`${chalk.bold(`${BIN} ${cmd.name}`)} — ${cmd.summary}`)
  if (cmd.description) {
    // -> Wrapped at 96 columns, which is what the rest of the help is laid out for
    const words = cmd.description.split(/\s+/)
    const lines = ['']
    for (const word of words) {
      if ((lines.at(-1)! + ' ' + word).trim().length > 96) {
        lines.push('')
      }
      lines[lines.length - 1] = (lines.at(-1)! + ' ' + word).trim()
    }
    console.log(`\n${lines.join('\n')}`)
  }
  if (Object.keys(cmd.options).length > 0) {
    console.log(`\n${chalk.bold('Options:')}\n${optionLines(cmd.options).join('\n')}`)
  }
  console.log(`\n${chalk.bold('Common options:')}\n${optionLines(GLOBAL_OPTIONS).join('\n')}`)
}

/**
 * Bring up what the models need — config, logger, database, caches, an event bus — and nothing else.
 *
 * The logger is held at `warn`: the models log their routine work at `info` for a server's log, and
 * that is noise in a terminal session. `--verbose` lets it through.
 */
async function boot({ verbose }: { verbose: boolean }): Promise<Set<Promise<void>>> {
  const SERVERPATH = import.meta.dirname
  const WIKI = {
    IS_DEBUG: process.env.NODE_ENV === 'development',
    ROOTPATH: path.dirname(SERVERPATH),
    SERVERPATH,
    INSTANCE_ID: `cli-${process.pid}`,
    auth: { groups: {}, strategies: {} },
    sites: {},
    sitesMappings: {},
    startedAt: Temporal.Now.instant()
  } as unknown as WikiGlobal
  global.WIKI = WIKI

  WIKI.configSvc = (await import('./core/config.ts')).default
  await WIKI.configSvc.init(true)
  WIKI.config.logLevel = verbose ? 'debug' : 'warn'
  WIKI.logger = (await import('./core/logger.ts')).default.init()

  WIKI.dbManager = (await import('./core/db.ts')).default
  // -> Worker mode: no migrations and no `dev.dropSchema`, and a single connection
  WIKI.db = await WIKI.dbManager.init(true)

  /*
    A change an instance caches has to reach every instance, which they do between themselves over
    NOTIFY (`core/db.ts`). The models emit on `outbound` as they would in a server; here each one is
    sent straight away, and `main` waits for the sends before it closes the connection.
  */
  const pending = new Set<Promise<void>>()
  WIKI.events = { inbound: new Emittery(), outbound: new Emittery() }
  // -> Cast for the same reason as `notifyViaDB`'s registration: one shape out of Emittery's union
  WIKI.events.outbound.onAny((({ name, data }: { name: PropertyKey; data?: unknown }) => {
    const payload = JSON.stringify({
      source: WIKI.INSTANCE_ID,
      event: name,
      value: data ?? null
    })
    const send = WIKI.dbManager
      .pool!.query('SELECT pg_notify($1, $2)', ['wiki', payload])
      .then(() => {})
      .catch((err: any) => {
        console.error(
          chalk.yellow(`! Could not tell running instances about ${String(name)}: ${err.message}`)
        )
      })
    pending.add(send)
    void send.finally(() => pending.delete(send))
  }) as any)
  return pending
}

async function main(): Promise<number> {
  if (!semver.satisfies(process.version, '>=26')) {
    throw new CliError('Node.js 26.x or later is required.')
  }

  const argv = process.argv.slice(2)
  const commandIndex = argv.findIndex((arg) => !arg.startsWith('-'))
  const commandName = commandIndex >= 0 ? argv[commandIndex] : undefined
  if (!commandName || commandName === 'help') {
    const target = commandName === 'help' ? argv[commandIndex + 1] : undefined
    const cmd = COMMANDS.find((c) => c.name === target)
    if (cmd) {
      printCommandHelp(cmd)
    } else {
      printHelp()
    }
    // -> Asked for, or nothing to do: help with no command is not a success a script should rely on
    return commandName === 'help' || argv.includes('--help') || argv.includes('-h') ? 0 : 2
  }
  const cmd = COMMANDS.find((c) => c.name === commandName)
  if (!cmd) {
    console.error(chalk.red(`Unknown command "${commandName}".\n`))
    printHelp()
    return 2
  }

  let values
  try {
    values = parseArgs({
      args: argv.toSpliced(commandIndex, 1),
      options: { ...GLOBAL_OPTIONS, ...cmd.options },
      strict: true,
      allowPositionals: false
    }).values
  } catch (err: any) {
    throw new CliError(`${err.message}\nRun ${BIN} ${cmd.name} --help for its options.`, 2)
  }
  if (values.help) {
    printCommandHelp(cmd)
    return 0
  }

  const pending = await boot({ verbose: Boolean(values.verbose) })
  try {
    const schema = await checkSchema()
    if (schema.problem && !cmd.toleratesSchemaMismatch) {
      throw new CliError(schema.problem)
    }
    WIKI.models = (await import('./models/index.ts')).default
    await WIKI.configSvc.loadFromDb()
    WIKI.cache = new NodeCache({ checkperiod: 0 })
    // -> Not started: `jobs.isHealthy` only reads its timings, which come from the config
    WIKI.scheduler = (await import('./core/scheduler.ts')).default
    if (!schema.problem) {
      await WIKI.models.sites.reloadCache()
    }

    await cmd.run(createContext({ yes: Boolean(values.yes), schema }), values)
    return 0
  } finally {
    await Promise.all(pending)
    await WIKI.dbManager.pool?.end()
  }
}

try {
  process.exitCode = await main()
} catch (err: any) {
  if (err instanceof CliError) {
    console.error(chalk.red(`✖ ${err.message}`))
    process.exitCode = err.exitCode
  } else {
    console.error(chalk.red(`✖ ${err.message}`))
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.error(err)
    }
    process.exitCode = 1
  }
}
// -> Explicit, because a library loaded with the models may hold the event loop open (a timer, a
//    pool of its own) long after the work is done
process.exit()
