import { sendPendingMail } from '../../notifications/mailer.ts'
import { refreshWorkerConfig } from '../../notifications/queue.ts'

/**
 * Send the notification emails that are due.
 *
 * Queued for the moment the next email comes due — by the fan-out when it writes one, and by each
 * run for whatever it leaves pending — and by the system schedule as a safety net. See
 * `notifications/mailer.ts`.
 *
 * In a worker thread, like webhook deliveries, because what it does is wait on somebody else's
 * server: a relay may take seconds to accept each mail, and a digest run goes through a hundred.
 */
export async function task(): Promise<void> {
  await WIKI.ensureDb!()
  await refreshWorkerConfig()
  // -> Its own deadline inside the pool's, as `dispatch-notifications.ts` explains
  const timeout = Number(WIKI.config.scheduler?.taskTimeout) || 300
  await sendPendingMail(AbortSignal.timeout(Math.max(timeout - 30, timeout / 2) * 1000))
}
