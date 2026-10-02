import crypto from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { settings as settingsTable } from '../db/schema.ts'

/**
 * What every boot makes sure of before anything else reads the settings.
 *
 * A release sometimes needs a value that an installation created before it cannot have: a secret
 * generated per installation, an identifier, a value derived from what is already stored. A key with
 * a static default needs none of this — it belongs in `base.yml`, which is merged under the stored
 * settings on every boot. A check is for what cannot be written down in advance, and it is the one
 * place such a value is filled in: nothing that reads a setting falls back on its own, and nothing
 * at install time duplicates what a check already does, since checks run after the first-run seed
 * as well.
 *
 * **Checks must be idempotent** — they run on every boot, and on every instance of an HA set — and
 * should only ever ADD what is missing. A check that changes a value somebody set is a migration of
 * meaning, not a startup check, and deserves more thought than this file gives it.
 */

/** Advisory lock held for the length of the checks' transaction. See `runStartupChecks`. */
const STARTUP_CHECKS_LOCK_KEY = 4210002

/** One thing every boot makes sure of. */
interface StartupCheck {
  /** What it ensures, as the boot log names it. */
  name: string
  /**
   * Do it, inside the checks' transaction.
   *
   * @returns Whether anything was written
   */
  run: (trx: any) => Promise<boolean>
}

/**
 * The common case: a key inside one of the settings blobs.
 *
 * `fill` is handed the blob as stored (an empty object when there is no row for it yet) and returns
 * the fields to add, or nothing when nothing is missing. What it returns is merged over the stored
 * blob and written back whole, so the fields it does not name are kept as they were.
 */
function settingsCheck(
  name: string,
  key: string,
  fill: (stored: Record<string, any>) => Record<string, any> | null
): StartupCheck {
  return {
    name,
    async run(trx) {
      const [row] = await trx
        .select({ value: settingsTable.value })
        .from(settingsTable)
        .where(eq(settingsTable.key, key))
      const stored = (row?.value ?? {}) as Record<string, any>
      const added = fill(stored)
      if (!added || Object.keys(added).length < 1) {
        return false
      }
      const value = { ...stored, ...added }
      await trx
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } })
      return true
    }
  }
}

/**
 * The checks, in the order they run. Add to the end; never remove one that a release has shipped
 * while an installation from before it could still be upgraded.
 */
const STARTUP_CHECKS: StartupCheck[] = [
  /*
    What notification unsubscribe links are signed with (`notifications/unsubscribe.ts`). Its own
    secret rather than `auth.secret`, which rotating the sessions replaces — and every unsubscribe
    link already in somebody's mailbox with it. Generated here rather than seeded at install, so that
    an installation from before notifications existed gets one too.
  */
  settingsCheck('notification unsubscribe secret', 'notifications', (stored) =>
    stored.unsubscribeSecret ? null : { unsubscribeSecret: crypto.randomBytes(32).toString('hex') }
  )
]

/**
 * Run every startup check, and say whether the settings need reading again.
 *
 * All of them in one transaction under an advisory lock, because the instances of an HA set boot
 * together: without it, two would each find the secret missing, each generate one, and the second
 * write would silently replace the first — after the first instance had already started signing
 * links with it. Under the lock, the second finds the first's value and has nothing to do.
 *
 * @returns Whether anything was written, in which case the caller reloads the settings
 */
export async function runStartupChecks(): Promise<boolean> {
  const applied: string[] = []
  await WIKI.db.transaction(async (trx: any) => {
    await trx.execute(sql`SELECT pg_advisory_xact_lock(${STARTUP_CHECKS_LOCK_KEY}::bigint)`)
    for (const check of STARTUP_CHECKS) {
      if (await check.run(trx)) {
        applied.push(check.name)
      }
    }
  })
  if (applied.length > 0) {
    WIKI.logger.info(`Startup checks filled in: ${applied.join(', ')} [ OK ]`)
  }
  return applied.length > 0
}
