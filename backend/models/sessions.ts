import crypto from 'node:crypto'
import { and, eq, lt, sql } from 'drizzle-orm'
import { sessions as sessionsTable } from '../db/schema.ts'

/**
 * How long a session lives after the request that last used it: the session cookie's `maxAge`
 * (`index.ts`), and the age at which {@link Sessions.purgeExpired} takes the row.
 */
export const SESSION_MAX_AGE_DAYS = 30

/**
 * Sessions model
 */
class Sessions {
  /**
   * Fetch all sessions from a single user
   *
   * @param userId User ID
   * @returns User Sessions
   */
  async getByUser(userId: string) {
    return WIKI.db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId))
  }

  /**
   * Fetch a single session by id
   *
   * @param id Session ID
   * @returns Session data
   */
  async get(id: string): Promise<any> {
    const res = await WIKI.db.select().from(sessionsTable).where(eq(sessionsTable.id, id))
    return res?.[0]?.data ?? null
  }

  /**
   * Set / Update a session
   *
   * @param id Session ID
   * @param data Session Data
   */
  async set(id: string, data: any): Promise<void> {
    await WIKI.db
      .insert(sessionsTable)
      .values([
        {
          id,
          userId: data?.user?.id ?? null,
          data
        }
      ])
      .onConflictDoUpdate({
        target: sessionsTable.id,
        set: {
          data,
          userId: data?.user?.id ?? null,
          updatedAt: sql`now()`
        }
      })
  }

  /**
   * Update a session, but only if it is still the generation the request read
   *
   * @fastify/session stamps every session with the id it was issued under
   * (`__fastifySessionMetadata.generation`) and saves an existing one through this rather than `set`,
   * so a request still in flight when its session was logged out or regenerated -- possibly on another
   * instance -- cannot write it back. Hence one conditional statement rather than a read and a write.
   *
   * @param id Session store ID
   * @param expectedGeneration Generation the session must still be at
   * @param data Session Data
   * @returns Whether the session was updated
   */
  async compareAndSet(id: string, expectedGeneration: string, data: any): Promise<boolean> {
    const updated = await WIKI.db
      .update(sessionsTable)
      .set({
        data,
        userId: data?.user?.id ?? null,
        updatedAt: sql`now()`
      })
      .where(
        and(
          eq(sessionsTable.id, id),
          sql`${sessionsTable.data} -> '__fastifySessionMetadata' ->> 'generation' = ${expectedGeneration}`
        )
      )
      .returning({ id: sessionsTable.id })
    return updated.length > 0
  }

  /**
   * Delete a session
   *
   * @param id Session ID
   */
  async destroy(id: string) {
    return WIKI.db.delete(sessionsTable).where(eq(sessionsTable.id, id))
  }

  /**
   * Delete the sessions nobody has used for {@link SESSION_MAX_AGE_DAYS}. Run hourly by
   * `tasks/simple/purge-sessions.ts`.
   *
   * Nothing else would: a session is only ever deleted by a logout, and most simply stop being used
   * -- a browser closed, a cookie expired. Anonymous requests leave rows too, since unlocking a
   * password-protected page or starting a passkey or SSO login writes to the session.
   *
   * The cookie is re-issued and the row saved on every request (`rolling`), so `updatedAt` is when
   * the session was last used, and past the cutoff no browser holds a cookie for it any more. One
   * presented regardless would be treated as expired by @fastify/session anyway.
   *
   * @returns How many sessions were deleted.
   */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(
      Temporal.Now.instant().subtract({ hours: SESSION_MAX_AGE_DAYS * 24 }).epochMilliseconds
    )
    const result = await WIKI.db.delete(sessionsTable).where(lt(sessionsTable.updatedAt, cutoff))
    return result.rowCount ?? 0
  }

  /**
   * Delete all sessions from all users
   *
   */
  async clearAllSessions() {
    return WIKI.db.delete(sessionsTable)
  }

  /**
   * Delete all sessions from a single user
   *
   * @param userId User ID
   */
  async clearSessionsFromUser(userId: string) {
    return WIKI.db.delete(sessionsTable).where(eq(sessionsTable.userId, userId))
  }

  /**
   * Replace the secret cookies are signed with, and end every session there is.
   *
   * The two halves do different work, and both are needed. Dropping the rows is what logs everybody
   * out **now**: a cookie whose session is gone identifies nothing, so the next request from every
   * browser — on every instance, since the rows are shared — starts a new, anonymous one. Rotating
   * the secret is what makes the cookies themselves worthless, and that one waits: @fastify/session
   * and @fastify/cookie are handed the secret when the HTTP server starts (`index.ts`), so this
   * server goes on validating signatures with the old one until it is restarted.
   *
   * The API key keypair is untouched: it carries its own passphrase (`models/apiKeys.ts`), so keys
   * already issued keep working.
   *
   * @returns How many sessions were ended, or null if the settings failed to save
   */
  async rotateSecret(): Promise<number | null> {
    const previousAuth = WIKI.config.auth
    WIKI.config.auth = { ...previousAuth, secret: crypto.randomBytes(32).toString('hex') }
    // -> Propagates as `reloadConfig`, so the other instances are holding the new secret the next
    //    time any of them restarts
    if (!(await WIKI.configSvc.saveToDb(['auth']))) {
      WIKI.config.auth = previousAuth
      return null
    }

    const result = await WIKI.db.delete(sessionsTable)
    const ended = result.rowCount ?? 0
    WIKI.logger.info(`Rotated the session secret and ended ${ended} session(s) [ OK ]`)
    return ended
  }
}

export const sessions = new Sessions()
