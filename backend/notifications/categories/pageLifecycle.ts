import { ownersOf } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * A lifecycle rule on a page the recipient owns has fired, and one of its actions was to tell the
 * owners. The rule's name travels as the excerpt, since it is what says why — "Review every quarter".
 *
 * Nobody did it, so there is no actor to leave out: the event is the daily run's. Coalesced per page,
 * so two rules firing on one page the same night are one entry counting to two.
 */
export const pageLifecycle: NotificationCategory = {
  key: 'pageLifecycle',
  section: 'reviews',
  events: ['page:lifecycle'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: true, email: true },
  priority: 25,
  recipients: ownersOf,
  access: 'read:pages',
  groupKey: (event) => `pageLifecycle:${event.data.page!.id}`,
  entry: (event) => ({
    variant: event.data.variant,
    pageId: event.data.page!.id,
    data: snapshotOf(event)
  })
}
