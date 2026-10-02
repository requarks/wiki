import { optedInTo } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * A page was deleted anywhere the recipient could read it. Off by default.
 *
 * Access is checked against the page as it was, from the event's snapshot, since there is no page
 * left to check. A watcher who also turned this on gets the `watchedPage` entry instead, which
 * outranks it. Silent for an import or a bulk operation, as `pageCreated` is.
 */
export const pageDeleted: NotificationCategory = {
  key: 'pageDeleted',
  section: 'everything',
  events: ['page:delete'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: false, email: false },
  priority: 5,
  recipients: (_event, after) => optedInTo('pageDeleted', after),
  access: 'read:pages',
  groupKey: (event) => `pageDeleted:${event.data.page!.id}`,
  entry: (event) => ({
    variant: event.data.variant,
    pageId: null,
    data: snapshotOf(event)
  })
}
