import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stripVTControlCharacters } from 'node:util'
import chalk from 'chalk'
import { sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { parse } from 'pg-connection-string'
import type { AuditAction, AuditKind } from '../models/auditLog.ts'

/**
 * The shared half of the management CLI: what every command is handed (`CliContext`), and the
 * checks made before any of them runs. `cli.ts` is the entry point and the command list.
 *
 * Everything here talks to a terminal, never to `WIKI.logger`. The logger is held at `warn` for the
 * CLI's whole run (see `cli.ts`), and output meant for the person at the keyboard — a new password
 * above all — must not end up wherever an instance's logs are shipped.
 */

/** A failure to report as a sentence rather than a stack trace. */
export class CliError extends Error {
  exitCode: number

  constructor(message: string, exitCode = 1) {
    super(message)
    this.exitCode = exitCode
  }
}

/** One option a command accepts, as `node:util`'s `parseArgs` takes it plus what `--help` prints. */
export interface CommandOption {
  type: 'string' | 'boolean'
  short?: string
  description: string
  /** What `--help` shows as the value, for a string option: `--email <address>`. */
  placeholder?: string
}

export type CommandValues = Record<string, string | boolean | undefined>

export interface Command {
  name: string
  /** One line, for the command list. */
  summary: string
  /** A paragraph or two for `<command> --help`, when one line does not say enough. */
  description?: string
  options: Record<string, CommandOption>
  /**
   * Run against a database whose schema is not this code's (see `checkSchema`) rather than refuse.
   * Only for a command that reads nothing a migration could have changed, and says so.
   */
  toleratesSchemaMismatch?: boolean
  run(ctx: CliContext, values: CommandValues): Promise<void>
}

/** A row of `table()`: column key to cell text. */
type Row = Record<string, string>

export interface CliContext {
  /** `--yes`: take every default and confirm every action without asking. */
  readonly yes: boolean
  /** Whether there is a person at a terminal to ask. */
  readonly interactive: boolean
  /** What `checkSchema` found. Only `toleratesSchemaMismatch` commands ever see a problem here. */
  readonly schema: SchemaStatus

  /**
   * A value the command cannot do without. Taken from the terminal when there is one; without one,
   * the command fails with a sentence naming the option that would have supplied it.
   */
  ask(question: string, option: string): Promise<string>
  /** A yes/no question with a default, which `--yes` and a missing terminal both take. */
  choose(question: string, defaultAnswer: boolean): Promise<boolean>
  /**
   * The last question before a command writes anything: shows which database it is about to change,
   * then asks. Throws when declined. `--yes` skips the question but not the summary.
   */
  confirmWrite(question: string): Promise<void>
  /** One of a numbered list, by its number. */
  pick<T>(question: string, items: T[], label: (item: T) => string, option: string): Promise<T>

  heading(text: string): void
  line(text?: string): void
  warn(text: string): void
  success(text: string): void
  table(columns: Array<{ key: string; title: string }>, rows: Row[]): void

  /**
   * Record what was done in the audit log, as the command line rather than as anybody's session:
   * there is no account behind a shell, so the row names the OS user and host instead.
   */
  audit(kind: AuditKind, action: AuditAction, meta?: Record<string, any>): Promise<void>
  /**
   * Tell every running instance about a change it caches, over the same `wiki` NOTIFY channel the
   * instances use between themselves (`core/db.ts`).
   */
  broadcast(event: string, value?: unknown): Promise<void>
}

/** Where the CLI is pointed, for the summary shown before a write. */
export function describeDatabase(): string {
  const schema = WIKI.config.db.schema
  if (process.env.DATABASE_URL) {
    const conf = parse(process.env.DATABASE_URL)
    return `${conf.database ?? '?'} on ${conf.host ?? '?'}:${conf.port ?? 5432} (schema ${schema}, from DATABASE_URL)`
  }
  const db = WIKI.config.db
  return `${db.db} on ${db.host}:${db.port} (schema ${schema})`
}

export interface SchemaStatus {
  /** Why the schema is not this code's, or null when it is. */
  problem: string | null
  /** The migrations the database has had, oldest first. */
  applied: string[]
}

/**
 * Refuse a database whose schema is not the one this code was written against.
 *
 * The CLI never migrates — that is a running instance's job, at boot — so it has to be the same
 * version as the instances it sits beside. A database with migrations this checkout does not have
 * belongs to newer code; one missing migrations this checkout has has not been upgraded yet. Either
 * way the models would read and write columns that are not there, and the person running a recovery
 * tool is the one least able to clean up after a half-applied write.
 *
 * Compared by name rather than hash: the hash is of the file's bytes, and a checkout with Windows
 * line endings would differ from the one that applied it without anything having changed.
 *
 * @throws CliError when there is no installation in the schema at all
 */
export async function checkSchema(): Promise<SchemaStatus> {
  const schema = WIKI.config.db.schema
  const ledger = await WIKI.db.execute(sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = ${schema} AND table_name = 'migrations'
  `)
  if (ledger.rows.length < 1) {
    throw new CliError(
      `There is no Wiki.js installation in schema "${schema}" of ${describeDatabase()}: start Wiki.js once to create it.`
    )
  }

  const onDisk = readMigrationFiles({
    migrationsFolder: path.join(WIKI.SERVERPATH, 'db/migrations')
  }).map((migration) => migration.name)
  const applied = (
    await WIKI.db.execute(sql`SELECT name FROM ${sql.identifier(schema)}.migrations ORDER BY id`)
  ).rows.map((row) => String(row.name))

  const pending = onDisk.filter((name) => !applied.includes(name))
  const unknown = applied.filter((name) => !onDisk.includes(name))
  if (unknown.length > 0) {
    return {
      applied,
      problem: `The database has ${unknown.length} migration(s) this copy of Wiki.js does not know about (latest: ${unknown.at(-1)}). It belongs to a newer version: run the CLI that shipped with it.`
    }
  }
  if (pending.length > 0) {
    return {
      applied,
      problem: `The database is ${pending.length} migration(s) behind this copy of Wiki.js (next: ${pending[0]}). Start the upgraded Wiki.js once so it can migrate, then run this again.`
    }
  }
  return { applied, problem: null }
}

/** The person behind the shell, as far as the machine knows. */
function operator(): { osUser: string; host: string } {
  let osUser = process.env.SUDO_USER || process.env.USER || ''
  try {
    osUser = osUser || os.userInfo().username
  } catch {
    // -> A container user with no passwd entry has no name to give
  }
  return { osUser: osUser || `uid ${process.getuid?.() ?? '?'}`, host: os.hostname() }
}

/** Pad to a visible width, ignoring the colour codes chalk adds. */
function pad(text: string, width: number): string {
  const visible = stripVTControlCharacters(text).length
  return text + ' '.repeat(Math.max(0, width - visible))
}

export function createContext({ yes, schema }: { yes: boolean; schema: SchemaStatus }): CliContext {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  const { osUser, host } = operator()

  /*
    One reader for the whole run, consumed as an iterator rather than with `rl.question`: the
    iterator queues lines that arrive before they are asked for, so answers pasted in one go reach
    the prompts they were meant for instead of the first prompt swallowing them all. No `output`, so
    readline leaves echoing to the terminal's own line discipline.
  */
  let lines: AsyncIterator<string> | null = null
  async function prompt(question: string): Promise<string> {
    lines ??= createInterface({ input: process.stdin })[Symbol.asyncIterator]()
    process.stdout.write(question)
    const next = await lines.next()
    if (next.done) {
      process.stdout.write('\n')
      throw new CliError('Cancelled. Nothing was changed.')
    }
    return String(next.value).trim()
  }

  const ctx: CliContext = {
    yes,
    interactive,
    schema,

    async ask(question, option) {
      if (!interactive) {
        throw new CliError(`Missing --${option}, and there is no terminal to ask for it on.`, 2)
      }
      for (;;) {
        const answer = await prompt(`${chalk.cyan('?')} ${question} `)
        if (answer) {
          return answer
        }
      }
    },

    async choose(question, defaultAnswer) {
      if (yes || !interactive) {
        ctx.line(`${chalk.cyan('?')} ${question} ${chalk.dim(defaultAnswer ? 'yes' : 'no')}`)
        return defaultAnswer
      }
      const hint = defaultAnswer ? '[Y/n]' : '[y/N]'
      for (;;) {
        const answer = (
          await prompt(`${chalk.cyan('?')} ${question} ${chalk.dim(hint)} `)
        ).toLowerCase()
        if (!answer) {
          return defaultAnswer
        }
        if (['y', 'yes'].includes(answer)) {
          return true
        }
        if (['n', 'no'].includes(answer)) {
          return false
        }
      }
    },

    async confirmWrite(question) {
      ctx.line()
      ctx.line(`${chalk.dim('Database:')} ${describeDatabase()}`)
      if (yes) {
        return
      }
      if (!interactive) {
        throw new CliError('Nothing was changed: pass --yes to confirm without a terminal.', 2)
      }
      const answer = (
        await prompt(`${chalk.yellow('?')} ${question} ${chalk.dim('[y/N]')} `)
      ).toLowerCase()
      if (!['y', 'yes'].includes(answer)) {
        throw new CliError('Cancelled. Nothing was changed.')
      }
    },

    async pick(question, items, label, option) {
      if (items.length < 1) {
        throw new CliError('There is nothing to choose from.')
      }
      if (!interactive) {
        throw new CliError(`Missing --${option}, and there is no terminal to choose on.`, 2)
      }
      const width = String(items.length).length
      items.forEach((item, index) => {
        ctx.line(`  ${chalk.cyan(String(index + 1).padStart(width))}  ${label(item)}`)
      })
      for (;;) {
        const answer = await prompt(
          `${chalk.cyan('?')} ${question} ${chalk.dim(`[1-${items.length}]`)} `
        )
        const index = Number.parseInt(answer, 10)
        if (String(index) === answer && index >= 1 && index <= items.length) {
          return items[index - 1]!
        }
      }
    },

    heading(text) {
      console.log(`\n${chalk.bold(text)}`)
    },
    line(text = '') {
      console.log(text)
    },
    warn(text) {
      console.log(`${chalk.yellow('!')} ${text}`)
    },
    success(text) {
      console.log(`${chalk.green('✔')} ${text}`)
    },
    table(columns, rows) {
      const widths = columns.map((col) =>
        Math.max(
          col.title.length,
          ...rows.map((row) => stripVTControlCharacters(row[col.key] ?? '').length)
        )
      )
      console.log('  ' + columns.map((col, i) => chalk.dim(pad(col.title, widths[i]!))).join('  '))
      for (const row of rows) {
        console.log('  ' + columns.map((col, i) => pad(row[col.key] ?? '', widths[i]!)).join('  '))
      }
    },

    async audit(kind, action, meta = {}) {
      await WIKI.models.auditLog.record({
        kind,
        action,
        actor: { id: null, name: `Command line (${osUser}@${host})`, email: null, ip: '' },
        meta: { ...meta, via: 'cli', osUser, host }
      })
    },

    async broadcast(event, value) {
      // -> `cli.ts` sends whatever is emitted here, and waits for it before exiting
      await WIKI.events.outbound.emit(event, value)
    }
  }
  return ctx
}

/** An account as the commands show it before acting on it. */
export function describeUser(user: { name: string; email: string }): string {
  return `${user.name} <${user.email}>`
}

/**
 * Look an account up by email, refusing the guest account: it is nobody's to sign in as, and every
 * command here that takes an email is about somebody signing in.
 */
export async function findUser(email: string) {
  const user = await WIKI.models.users.getByEmail(email.trim().toLowerCase())
  if (!user) {
    throw new CliError(`There is no account with the email address ${email.trim()}.`)
  }
  if (user.isSystem) {
    throw new CliError(`${email.trim()} is the guest account, which nobody signs in as.`)
  }
  return user
}
