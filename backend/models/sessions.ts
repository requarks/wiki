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
}

export const sessions = new Sessions()
