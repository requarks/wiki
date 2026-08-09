/**
 * Deliver one event to one webhook.
 *
 * Queued by `models/hooks.ts` → `emit()`, one job per subscribed webhook, so that a slow endpoint
 * delays nothing else and a failing one is retried with the scheduler's backoff.
 */
export async function task(payload: {
  hookId: string
  event: string
  data: Record<string, any>
}): Promise<void> {
  await WIKI.models.hooks.deliver(payload)
}
