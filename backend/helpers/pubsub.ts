import type { PoolClient } from 'pg'

/**
 * A `pg_notify` sender for one LISTEN/NOTIFY client.
 *
 * Sending is fire-and-forget by design — see `createNotifier` for why that has to be arranged rather
 * than simply left unawaited.
 */
export interface Notifier {
  /** Queue a notification behind whatever is already going out. Never throws. */
  send(channel: string, payload: string): void
  /** Resolves once everything queued so far has gone out, for an orderly shutdown. */
  drained(): Promise<void>
}

/**
 * Serialize the notifications sent on a dedicated LISTEN/NOTIFY client.
 *
 * Three modules hold such a client — the event bus (`core/db.ts`), the scheduler and collaborative
 * editing — and all three publish from places that cannot wait for a round trip to postgres: an
 * Emittery listener, a job being picked up, a Yjs handler reacting to a keystroke. So none of them
 * awaits the `pg_notify`.
 *
 * Handing an unawaited query to a client that is already running one is exactly what `pg` deprecated
 * in 8.x and removes in 9.0. It queues them internally today, which is why this went unnoticed: the
 * only symptom is a `DeprecationWarning`, and `util.deprecate` emits it once per process however often
 * it happens. Queueing them here instead costs nothing — the round trips were already serialized, only
 * silently and on the way out.
 *
 * Every notification carries its own `catch`, rather than one at the end of the chain: a failure to
 * publish belongs to the message that failed, and must not stop the ones behind it from going out.
 *
 * @param client Read on each send, since the client is opened after this is built and dropped at
 *               shutdown. A notification sent while there is none is discarded.
 * @param label  What these notifications are, for the log line when one cannot be sent
 */
export function createNotifier(client: () => PoolClient | null, label: string): Notifier {
  let tail: Promise<void> = Promise.resolve()
  return {
    send(channel: string, payload: string): void {
      tail = tail.then(async () => {
        try {
          await client()?.query('SELECT pg_notify($1, $2)', [channel, payload])
        } catch (err: any) {
          WIKI.logger.warn(`Failed to publish a ${label} notification: ${err.message}`)
        }
      })
    },
    drained(): Promise<void> {
      return tail
    }
  }
}
