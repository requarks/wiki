import { dispatchPending } from '../../notifications/fanout.ts'
import { refreshWorkerConfig } from '../../notifications/queue.ts'

/**
 * Turn whatever has happened into notifications for the people it concerns.
 *
 * Queued by `notifications.emit()` — debounced, so a burst of saves is one run rather than one each —
 * and by the system schedule as a safety net, for an instance that went down with a run still owed.
 * Each run drains the outbox (`notificationEvents`) as far as it can; see `notifications/fanout.ts`.
 *
 * In a worker thread because the audience of one event can be every account on the instance: an
 * access check per group set and a few thousand rows written is time the event loop would otherwise
 * spend not serving pages. A worker starts with nothing but config and a logger, so the database is
 * opened here and everything the fan-out needs is imported by it rather than taken off `WIKI.models`.
 */
export async function task(): Promise<void> {
  await WIKI.ensureDb!()
  await refreshWorkerConfig()
  /*
    The pool aborts a worker at `scheduler.taskTimeout` without telling the task, so the task keeps
    its own deadline a little inside that: the fan-out stops between batches when it passes, writes
    down how far each event got, and the next run carries on from there.
  */
  const timeout = Number(WIKI.config.scheduler?.taskTimeout) || 300
  await dispatchPending(AbortSignal.timeout(Math.max(timeout - 30, timeout / 2) * 1000))
}
