import { lt, sql } from 'drizzle-orm'
import { rateLimits as rateLimitsTable } from '../db/schema.ts'

/** How a limit is configured: what it allows, over how long, and what it costs to exceed. */
export interface RateLimitPolicy {
  /** Attempts allowed within the window. The one that exceeds it is what earns the ban. */
  max: number
  /** Length of the window, in seconds. */
  windowSeconds: number
  /** How long the ban lasts once earned, in seconds. */
  banSeconds: number
}

/** What the caller does about an attempt. */
export interface RateLimitVerdict {
  /** Whether the attempt may proceed. */
  allowed: boolean
  /** Attempts made in the current window, the one just counted included. */
  hits: number
  /** Seconds until the client may try again. Zero while it is still allowed. */
  retryAfter: number
}

/**
 * Rate limits model
 *
 * A fixed window per key, with a ban for going over it — the counter that stands behind the login and
 * the other endpoints where guessing is the attack (`helpers/rateLimit.ts` is what applies it).
 *
 * Every attempt is one statement, and the statement decides everything: whether the window has rolled
 * over, whether the ban has lifted, what the count now is, and whether this attempt has just earned a
 * ban. Doing it in the database rather than in the process is the whole point — two instances behind
 * a load balancer share one counter, and a ban issued by one is honoured by both.
 */
class RateLimits {
  /**
   * Count an attempt against a key, and say whether it may proceed.
   *
   * The row is read, rolled over, incremented and possibly banned in a single upsert, so concurrent
   * attempts cannot both read the same count and both decide they are under the limit. What comes
   * back is the row as it now stands.
   *
   * A banned key stops counting: its ban runs for exactly as long as it was set for, rather than
   * being pushed further out by every attempt made during it. When the ban lifts, the window starts
   * again from nothing — having served it, a client is not one attempt away from serving another.
   *
   * @param key What is being limited and who by, e.g. `auth:203.0.113.4`
   */
  async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitVerdict> {
    const window = sql`make_interval(secs => ${policy.windowSeconds})`
    /*
      The three cases, in the order the CASE arms decide them:

        1. still banned      -- nothing changes; the attempt is refused
        2. window rolled over, or a ban has just expired -- the row starts again at this attempt
        3. otherwise         -- one more attempt, and a ban if that is one too many

      `"rateLimits"` rather than the aliased `excluded`: these have to read the row AS IT WAS, and
      `excluded` is the row this statement proposed.
    */
    const rolledOver = sql`"rateLimits"."bannedUntil" is not null or "rateLimits"."windowStartedAt" <= now() - ${window}`
    const stillBanned = sql`"rateLimits"."bannedUntil" > now()`
    const rows = await WIKI.db.execute(sql`
      insert into "rateLimits" ("key", "hits", "windowStartedAt", "updatedAt")
      values (${key}, 1, now(), now())
      on conflict ("key") do update set
        "hits" = case
          when ${stillBanned} then "rateLimits"."hits"
          when ${rolledOver} then 1
          else "rateLimits"."hits" + 1
        end,
        "windowStartedAt" = case
          when ${stillBanned} then "rateLimits"."windowStartedAt"
          when ${rolledOver} then now()
          else "rateLimits"."windowStartedAt"
        end,
        "bannedUntil" = case
          when ${stillBanned} then "rateLimits"."bannedUntil"
          when ${rolledOver} then null
          when "rateLimits"."hits" + 1 > ${policy.max} then now() + make_interval(secs => ${policy.banSeconds})
          else null
        end,
        "updatedAt" = now()
      returning
        "hits",
        "bannedUntil" > now() as "isBanned",
        greatest(0, ceil(extract(epoch from coalesce("bannedUntil", now()) - now())))::int as "retryAfter"
    `)
    const row = (rows as any).rows?.[0] ?? (rows as any)[0]
    return {
      allowed: !row?.isBanned,
      hits: Number(row?.hits ?? 0),
      retryAfter: row?.isBanned ? Number(row.retryAfter) : 0
    }
  }

  /**
   * Forget a key, e.g. once the attempt it was counting has succeeded.
   */
  async reset(key: string): Promise<void> {
    await WIKI.db.delete(rateLimitsTable).where(sql`${rateLimitsTable.key} = ${key}`)
  }

  /**
   * Drop rows nothing has touched for a day.
   *
   * Only ever about reclaiming space: a stale row is already harmless, since the next attempt on that
   * key rolls its window over before reading it. A key nobody has used in a day is one nobody is
   * being limited by.
   *
   * @returns How many rows were dropped
   */
  async purgeStale(): Promise<number> {
    const result = await WIKI.db
      .delete(rateLimitsTable)
      .where(lt(rateLimitsTable.updatedAt, sql`now() - interval '1 day'`))
    return result.rowCount ?? 0
  }
}

export const rateLimits = new RateLimits()
