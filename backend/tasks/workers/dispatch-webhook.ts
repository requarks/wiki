import { hooks } from '../../models/hooks.ts'

/**
 * Deliver one event to one webhook.
 *
 * Queued by `models/hooks.ts` → `emit()`, one job per subscribed webhook, so that a slow endpoint
 * delays nothing else and a failing one is retried with the scheduler's backoff.
 *
 * Runs in a worker thread rather than in-process, because what it does is wait on somebody else's
 * server: an endpoint is allowed to take up to `DELIVERY_TIMEOUT` to answer, and a wiki with a few
 * webhooks on a busy event queues those deliveries in bursts. On the main thread that is time the
 * event loop spends on other people's HTTP instead of on serving pages.
 *
 * A worker task is handed the whole job rather than its payload — see `worker.ts` — and starts with
 * nothing but config and a logger, so the database connection is opened on demand and the one model
 * this needs is imported here rather than taken off `WIKI.models`, which a worker does not carry.
 */
export async function task(job: {
  payload: {
    hookId: string
    event: string
    data: Record<string, any>
    instance: string
  }
}): Promise<void> {
  await WIKI.ensureDb!()
  await hooks.deliver(job.payload)
}
