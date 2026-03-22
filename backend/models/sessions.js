import { eq, sql } from 'drizzle-orm'
import { sessions as sessionsTable } from '../db/schema.js'

/**
 * Sessions model
 */
class Sessions {
  /**
   * Fetch all sessions from a single user
   *
   * @param {String} userId User ID
   * @returns Promise<Array> User Sessions
   */
  async getByUser(userId) {
    return WIKI.db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId))
  }

  /**
   * Fetch a single session by id
   *
   * @param {String} id Session ID
   * @returns Promise<Object> Session data
   */
  async get(id) {
    const res = await WIKI.db.select().from(sessionsTable).where(eq(sessionsTable.id, id))
    return res?.[0]?.data ?? null
  }

  /**
   * Set / Update a session
   *
   * @param {String} id Session ID
   * @param {Object} data Session Data
   */
  async set(id, data) {
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
   * @param {String} id Session ID
   * @returns Promise<void>
   */
  async destroy(id) {
    return WIKI.db.delete(sessionsTable).where(eq(sessionsTable.id, id))
  }

  /**
   * Delete all sessions from all users
   *
   * @returns Promise<void>
   */
  async clearAllSessions() {
    return WIKI.db.delete(sessionsTable)
  }

  /**
   * Delete all sessions from a single user
   *
   * @param {String} userId User ID
   * @returns Promise<void>
   */
  async clearSessionsFromUser(userId) {
    return WIKI.db.delete(sessionsTable).where(eq(sessionsTable.userId, userId))
  }
}

export const sessions = new Sessions()
