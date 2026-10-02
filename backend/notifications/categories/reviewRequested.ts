import { reviewersOf } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * An edit suggestion is waiting for review, on a page whose rules name one of the recipient's groups
 * as a reviewer.
 *
 * No page permission is checked on top: the rule naming the group IS the grant, and an entry says no
 * more than the reviewer's own queue already shows them. A submitter revising a suggestion that is
 * still open bumps the entry they already have, since it is the same suggestion.
 */
export const reviewRequested: NotificationCategory = {
  key: 'reviewRequested',
  section: 'reviews',
  events: ['submission:new'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: true, email: true },
  priority: 30,
  recipients: reviewersOf,
  access: null,
  groupKey: (event) => `review:${event.data.submissionId}`,
  entry: (event) => ({
    variant: event.data.variant,
    pageId: event.data.page?.id ?? null,
    data: snapshotOf(event)
  })
}
