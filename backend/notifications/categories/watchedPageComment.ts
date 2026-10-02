import { watchersOf } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * Somebody commented on a page the recipient watches.
 *
 * Per page rather than per comment, so a lively discussion is one entry counting up rather than a
 * stack of them — the Talk tab is where the comments are read, and opening it marks the entry read.
 */
export const watchedPageComment: NotificationCategory = {
  key: 'watchedPageComment',
  section: 'discussions',
  events: ['comment:new'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: true, email: true },
  priority: 10,
  recipients: watchersOf,
  access: 'read:comments',
  groupKey: (event) => `watchedComment:${event.data.page!.id}`,
  entry: (event) => ({
    variant: event.data.variant,
    pageId: event.data.page!.id,
    commentId: event.data.commentId ?? null,
    data: snapshotOf(event)
  })
}
