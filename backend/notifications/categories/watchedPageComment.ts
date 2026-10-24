import { watchersOf } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * Somebody commented on a page the recipient watches.
 *
 * Per page rather than per comment, so a lively discussion is one entry counting up rather than a
 * stack of them — the Talk tab is where the comments are read, and opening it marks the entry read.
 *
 * Also for a feedback board's status change that came with a comment, which posts no `comment:new`
 * of its own (`feedback:status` is one event, so that the fan-out can deduplicate across everybody it
 * reaches). A watcher who did not submit or vote for the idea hears about the comment here; one who
 * did is told by `feedbackStatus` instead, which outranks this.
 */
export const watchedPageComment: NotificationCategory = {
  key: 'watchedPageComment',
  section: 'discussions',
  events: ['comment:new', 'feedback:status'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: true, email: true },
  priority: 10,
  // -> A status change with no comment is neither an edit nor a comment, which is what a watcher
  //    asked to hear about
  appliesTo: (event) => event.kind !== 'feedback:status' || Boolean(event.data.commentId),
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
