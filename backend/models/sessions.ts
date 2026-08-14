import crypto from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { sessions as sessionsTable } from '../db/schema.ts'

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
   * Delete a session
   *
   * @param id Session ID
   */
  async destroy(id: string) {
    return WIKI.db.delete(sessionsTable).where(eq(sessionsTable.id, id))
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
