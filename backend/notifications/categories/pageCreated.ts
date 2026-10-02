import { optedInTo } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * A page was created anywhere the recipient may read. Off by default, and busy when turned on.
 *
 * On creation whatever the page's publish state, which the entry says — a signed-in reader with
 * `read:pages` sees an unpublished page, so being told about one tells them nothing they could not
 * find. Silent for an import or a bulk operation: restoring five thousand pages is not news to
 * everybody who asked about new ones.
 */
export const pageCreated: NotificationCategory = {
  key: 'pageCreated',
  section: 'everything',
  events: ['page:create'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: false, email: false },
  priority: 5,
  recipients: (_event, after) => optedInTo('pageCreated', after),
  access: 'read:pages',
  groupKey: (event) => `pageCreated:${event.data.page!.id}`,
  entry: (event) => ({
    variant: event.data.variant,
    pageId: event.data.page!.id,
    data: snapshotOf(event)
  })
}
