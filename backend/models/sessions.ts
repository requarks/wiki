import crypto from 'node:crypto'
import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { sessions as sessionsTable } from '../db/schema.ts'
import { hasUserSession } from '../helpers/requester.ts'

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
   * @param exceptId A session to leave alone — the one making the request, when somebody changes
   *   their own password and the device they did it from should stay signed in
   */
  async clearSessionsFromUser(userId: string, exceptId?: string) {
    return this.clearSessionsFromUsers([userId], exceptId)
  }

  /**
   * Delete all sessions from a set of users
   *
   * @param userIds User IDs
   * @param exceptId A session to leave alone, as for {@link clearSessionsFromUser}
   */
  async clearSessionsFromUsers(userIds: string[], exceptId?: string) {
    if (userIds.length < 1) {
      return
    }
    await WIKI.db
      .delete(sessionsTable)
      .where(
        and(
          inArray(sessionsTable.userId, userIds),
          exceptId ? ne(sessionsTable.id, exceptId) : undefined
        )
      )
  }

  /**
   * Bring these users' sessions in line with a change to what they may do: the groups they are in,
   * or the global permissions of one of those groups.
   *
   * A session carries a copy of both, taken at login (`users.updateSession`), and every request is
   * judged against that copy — so without this, a user taken out of a group keeps its permissions
   * until they log out, and one put into a group with a DENY rule goes on ignoring it. Ending the
   * session is the answer rather than rewriting it: a request in flight saves the session back when
   * it ends, and would put the old copy back over a rewritten row, where a deleted one makes that save
   * fail and the cookie go with it (`compareAndSet`).
   *
   * The request making the change keeps its own session, refreshed in place where it belongs to one
   * of these users: an administrator taking themselves out of a group is shown the result rather
   * than the login screen.
   *
   * @param req The request making the change. Absent for one acting as nobody's session.
   */
  async refreshAccess(userIds: string[], req?: FastifyRequest): Promise<void> {
    const ownUserId =
      req && hasUserSession(req) && userIds.includes(req.session.user!.id)
        ? req.session.user!.id
        : null
    await this.clearSessionsFromUsers(userIds, ownUserId ? req!.session.sessionStoreId : undefined)
    if (ownUserId) {
      const actor = await WIKI.models.groups.actorForUser(ownUserId)
      req!.session.groups = actor.groupIds
      req!.session.permissions = actor.permissions
    }
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
