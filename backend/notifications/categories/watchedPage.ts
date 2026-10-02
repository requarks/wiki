import { watchersOf } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * A page somebody watches changed: it was edited, moved, published or unpublished, rescheduled, or
 * deleted.
 *
 * One category for all of it rather than one per kind of change, because watching is one thing a
 * reader asked for — "tell me about this page" — and the variants are how the entry says which. It
 * fires for every origin: a page a git pull rewrote has changed exactly as much as one somebody saved.
 */
export const watchedPage: NotificationCategory = {
  key: 'watchedPage',
  section: 'watching',
  events: ['page:edit', 'page:rename', 'page:delete'],
  scope: 'site',
  origins: ['user', 'import', 'bulk'],
  defaults: { inApp: true, email: true },
  priority: 20,
  recipients: watchersOf,
  access: 'read:pages',
  // -> Per page, so a page saved forty times while nobody looked is one entry counting to forty
  groupKey: (event) => `watchedPage:${event.data.page!.id}`,
  entry: (event) => ({
    variant: event.data.variant,
    pageId: event.kind === 'page:delete' ? null : event.data.page!.id,
    data: snapshotOf(event)
  })
}
