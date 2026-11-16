import { setTimeout as sleep } from 'node:timers/promises'
import { DatabaseError, type PoolClient, type QueryConfig } from 'pg'

/**
 * How often an idle subscription sends `SELECT 1`.
 *
 * A LISTEN connection on a quiet channel carries nothing in either direction for hours, and whatever
 * sits between it and postgres — a proxy, a load balancer, a NAT table — is free to forget an idle
 * connection: HAProxy after its `timeout client`/`timeout server`, an AWS NLB after 350 seconds, an
 * Azure one after four minutes. TCP keepalives do not count as traffic to most of them, so this has
 * to be a query. A minute is well inside every default worth knowing and costs one round trip.
 */
const KEEPALIVE_INTERVAL = 60 * 1000

/**
 * How long a query on a subscription's connection may go unanswered before the connection is taken
 * for dead. A dropped connection that nobody told us about (no RST, no FIN — a proxy forgetting it
 * silently) would otherwise hold the queue until the kernel gives up retransmitting, a quarter of an
 * hour later.
 */
const QUERY_TIMEOUT = 10 * 1000

/** The longest wait between two attempts at re-subscribing. */
const MAX_RECONNECT_DELAY = 30 * 1000

/**
 * How many notifications are held while there is no connection to send them on. The oldest go first
 * past that: an outage long enough to fill it is one where what the other instances most need is the
 * catch-up `onResubscribe` does anyway.
 */
const MAX_QUEUED = 1000

export interface ChannelOptions {
  /** The LISTEN/NOTIFY channel, which is both what is listened to and what `send` publishes on. */
  channel: string
  /**
   * What the connection names itself after the instance id, in `application_name` — `EVENTS` reads as
   * `Wiki.js - <instance>:EVENTS`. The admin area's instance list and `collab.hasPeers` read these.
   */
  role: string
  /** What these notifications are, for the log lines. */
  label: string
  /** Called with each notification's payload. A rejection or a throw is logged, never fatal. */
  onNotification(payload: string): void | Promise<void>
  /**
   * Called once a lost connection has been replaced and is listening again. Whatever the other
   * instances published in between was not received, and this is where a channel makes up for it.
   * Not called on the first `open`.
   */
  onResubscribe?(): void | Promise<void>
}

/** A dedicated LISTEN/NOTIFY connection that survives losing its connection. See `createChannel`. */
export interface Channel {
  /** Whether there is a live connection listening right now. */
  readonly connected: boolean
  /** Take a connection from the pool and start listening. Throws if that first attempt fails. */
  open(): Promise<void>
  /** Queue a notification behind whatever is already going out. Never throws. */
  send(payload: string): void
  /** Send what is queued, if there is a connection to send it on, and give the connection back. */
  close(): Promise<void>
}

/**
 * Whether postgres's answer was that the connection is ending — class 08 (connection exception) or one
 * of the 57P shutdowns (`pg_terminate_backend`, a server stopping, a failover). Those arrive as an
 * error response to the query in flight, a moment before the socket closes and the client says so
 * itself.
 */
function isConnectionError(err: DatabaseError): boolean {
  return err.code?.startsWith('08') === true || err.code?.startsWith('57P') === true
}

/**
 * Run a query on a subscription's connection, failing it after {@link QUERY_TIMEOUT}.
 *
 * pg honours `query_timeout` per query, but its types only know it as a client option — and this
 * client comes out of the shared pool, whose other users must not inherit it.
 */
function timedQuery(client: PoolClient, text: string, values?: unknown[]): Promise<unknown> {
  return client.query({ text, values, query_timeout: QUERY_TIMEOUT } as QueryConfig)
}

/** A queued `SELECT 1`, told apart from a payload by identity. */
const PING = Symbol('ping')

/**
 * A dedicated LISTEN/NOTIFY connection, kept alive and replaced when it is lost.
 *
 * Three modules hold one — the event bus (`core/db.ts`), the scheduler and collaborative editing — each
 * checked out of the pool for the life of the process. Such a connection is the one most exposed to
 * being dropped (a quiet channel is idle for hours, and a failover or a proxy restart takes it as
 * surely as any other), and a pool client that is checked out has no error listener of its own: pg
 * emits `error` on it, and an `error` event nobody listens to takes the process down. So the listener
 * is attached before anything else, and losing the connection means taking another one and listening
 * again, with a backoff, rather than an exit.
 *
 * **Sending is fire-and-forget by design.** All three publish from places that cannot wait for a round
 * trip to postgres: an Emittery listener, a job being picked up, a Yjs handler reacting to a keystroke.
 * Handing an unawaited query to a client that is already running one is what `pg` deprecated in 8.x
 * and removes in 9.0, so the notifications are queued here and sent one at a time. The queue is also
 * what carries them over an outage: a notification sent while there is no connection waits for the
 * next one, rather than being lost.
 *
 * A notification postgres refuses (a payload over 8000 bytes, say) is dropped with a warning and does
 * not stop the ones behind it. One that fails because the connection did is kept, and goes out on the
 * replacement.
 */
export function createChannel(options: ChannelOptions): Channel {
  const { channel, role, label } = options
  const queue: Array<string | typeof PING> = []
  let current: PoolClient | null = null
  let closed = false
  let pumping: Promise<void> | null = null
  let reconnecting: Promise<void> | null = null
  let keepaliveTimer: NodeJS.Timeout | null = null
  let overflowWarned = false
  const abort = new AbortController()

  /** Take a connection and listen on it. The connection is `current` only once it is listening. */
  async function connect(): Promise<void> {
    const client = await WIKI.dbManager.pool!.connect()
    // -> First, before any query can fail: from here on, an error on this client is a lost
    //    connection to replace rather than an unhandled event. Never removed, so an error that a
    //    released client emits late is still heard (and ignored, being no longer `current`).
    client.on('error', (err) => lose(client, err))
    client.on('notification', (msg) => {
      if (client !== current || msg.channel !== channel || !msg.payload) {
        return
      }
      try {
        Promise.resolve(options.onNotification(msg.payload)).catch((err: any) => {
          WIKI.logger.warn(`Failed to handle a ${label} notification: ${err.message}`)
        })
      } catch (err: any) {
        WIKI.logger.warn(`Failed to handle a ${label} notification: ${err.message}`)
      }
    })
    try {
      await timedQuery(client, `SET application_name = 'Wiki.js - ${WIKI.INSTANCE_ID}:${role}'`)
      await timedQuery(client, `LISTEN ${channel}`)
    } catch (err: any) {
      client.release(err)
      throw err
    }
    if (closed) {
      client.release(true)
      return
    }
    current = client
    overflowWarned = false
    keepaliveTimer = setInterval(() => {
      // -> Only when nothing else is going out: a notification is traffic enough
      if (current && queue.length === 0 && !pumping) {
        queue.push(PING)
        pump()
      }
    }, KEEPALIVE_INTERVAL)
  }

  /** Give up on a connection that failed, and start replacing it. */
  function lose(client: PoolClient, err: Error): void {
    if (client !== current) {
      return
    }
    current = null
    clearInterval(keepaliveTimer!)
    keepaliveTimer = null
    client.release(err)
    if (closed) {
      return
    }
    WIKI.logger.warn(`Lost the ${label} database connection (${err.message}), reconnecting...`)
    reconnecting ??= reconnect().finally(() => {
      reconnecting = null
    })
  }

  async function reconnect(): Promise<void> {
    for (let attempt = 0; !closed; attempt++) {
      try {
        await sleep(Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY), undefined, {
          signal: abort.signal
        })
        await connect()
      } catch (err: any) {
        if (closed) {
          return
        }
        WIKI.logger.warn(`Failed to reconnect the ${label} database connection: ${err.message}`)
        continue
      }
      if (closed) {
        return
      }
      WIKI.logger.info(`Reconnected the ${label} database connection: [ OK ]`)
      pump()
      try {
        await options.onResubscribe?.()
      } catch (err: any) {
        WIKI.logger.warn(`Failed to catch up on the ${label} after reconnecting: ${err.message}`)
      }
      return
    }
  }

  /** Send what is queued, one at a time, for as long as there is a connection to send it on. */
  function pump(): void {
    if (pumping || !current) {
      return
    }
    pumping = (async () => {
      while (queue.length > 0 && current) {
        const client: PoolClient = current
        const item = queue[0]
        try {
          if (item === PING) {
            await timedQuery(client, 'SELECT 1')
          } else {
            await timedQuery(client, 'SELECT pg_notify($1, $2)', [channel, item])
          }
          queue.shift()
        } catch (err: any) {
          if (err instanceof DatabaseError && !isConnectionError(err) && client === current) {
            // -> Postgres answered, and the answer was no: this message is the problem, not the
            //    connection, and the ones behind it can still go
            queue.shift()
            WIKI.logger.warn(`Failed to publish a ${label} notification: ${err.message}`)
            continue
          }
          // -> The connection is gone or not answering. The message stays queued for the next one;
          //    a ping does not, since the next connection is fresh.
          if (item === PING) {
            queue.shift()
          }
          lose(client, err)
        }
      }
    })().finally(() => {
      pumping = null
    })
  }

  return {
    get connected() {
      return current !== null
    },
    async open(): Promise<void> {
      await connect()
    },
    send(payload: string): void {
      if (closed) {
        return
      }
      queue.push(payload)
      if (queue.length > MAX_QUEUED) {
        queue.shift()
        if (!overflowWarned) {
          overflowWarned = true
          WIKI.logger.warn(
            `Dropping ${label} notifications: more than ${MAX_QUEUED} are waiting for the database connection`
          )
        }
      }
      pump()
    },
    async close(): Promise<void> {
      closed = true
      abort.abort()
      clearInterval(keepaliveTimer!)
      keepaliveTimer = null
      // -> Whatever is still on its way out goes out first: releasing the client from under a
      //    notification in flight would fail that one for no reason
      while (pumping) {
        await pumping
      }
      if (current) {
        const client = current
        current = null
        client.release(true)
      }
    }
  }
}
