/** How a bucket is shaped: how many calls may be made at once, and how fast it fills back up. */
export interface TokenBucketPolicy {
  /** The most calls a key may make back to back, which is also how full a new bucket starts. */
  burst: number
  /** How many calls a key earns back per minute, refilled continuously rather than in steps. */
  perMinute: number
}

/** What `take` decided. `retryAfter` is in whole seconds, and zero when the call was allowed. */
export interface TokenBucketVerdict {
  allowed: boolean
  retryAfter: number
}

interface Bucket {
  tokens: number
  /** When `tokens` was last brought up to date, in milliseconds on the monotonic clock. */
  updatedAt: number
}

/**
 * A rate limiter counted in memory, per instance.
 *
 * The other limiter (`models/rateLimits.ts`) is a postgres row per key, which is exact across an HA
 * set and costs a write per request. That is the right trade for a login form, where requests come
 * one at a time and a guess is what is being counted. It is the wrong one for an agent, which fans
 * out — a dozen searches and reads in parallel is an ordinary turn — so counting each call with a
 * database write would load the database with the very burst the limit exists to absorb.
 *
 * The cost is that each instance counts alone: a client the load balancer spreads over N instances
 * gets up to N budgets. That is accepted, since what this is for is stopping a runaway client from
 * hurting the instance it is hammering, which a per-instance count does.
 *
 * A token bucket rather than a fixed window: a burst up to `burst` is allowed at once, and after that
 * calls are paced at `perMinute` — so an agent that asks for ten things together is not refused for
 * it, and one that loops forever settles to the steady rate instead of being banned outright.
 *
 * The map is bounded, because a key can be a client address and addresses are not: once it is full,
 * the bucket used least recently is dropped. A dropped bucket comes back full, which errs towards
 * letting a client through — the right way round for a limiter that is not a security boundary.
 */
export class TokenBucketLimiter {
  #buckets = new Map<string, Bucket>()
  #maxEntries: number

  constructor(maxEntries = 10000) {
    this.#maxEntries = maxEntries
  }

  /** Spend one token from `key`'s bucket, if it has one. */
  take(key: string, policy: TokenBucketPolicy): TokenBucketVerdict {
    const burst = Math.max(1, policy.burst)
    const perMs = Math.max(1, policy.perMinute) / 60000
    const now = performance.now()

    const existing = this.#buckets.get(key)
    let bucket: Bucket
    if (existing) {
      // -> Re-inserted below, so that the Map's insertion order is least recently used first
      this.#buckets.delete(key)
      bucket = {
        tokens: Math.min(burst, existing.tokens + (now - existing.updatedAt) * perMs),
        updatedAt: now
      }
    } else {
      bucket = { tokens: burst, updatedAt: now }
    }
    this.#buckets.set(key, bucket)

    if (this.#buckets.size > this.#maxEntries) {
      const oldest = this.#buckets.keys().next().value
      if (oldest !== undefined) {
        this.#buckets.delete(oldest)
      }
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true, retryAfter: 0 }
    }
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((1 - bucket.tokens) / perMs / 1000))
    }
  }
}
