import { mentionedIn } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * Somebody wrote the recipient's `@handle` in a comment.
 *
 * On an edit, only a handle the comment did not already contain counts, so re-saving a comment does
 * not mention everybody in it a second time. The recipient still needs `read:comments` on the page:
 * a mention in a discussion somebody may not read would otherwise be a way of leaking it to them.
 */
export const mention: NotificationCategory = {
  key: 'mention',
  section: 'discussions',
  events: ['comment:new', 'comment:edit'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: true, email: true },
  priority: 40,
  appliesTo: (event) => (event.data.mentionHandles ?? []).length > 0,
  recipients: mentionedIn,
  access: 'read:comments',
  // -> Per comment: two mentions in two comments are two things to answer
  groupKey: (event) => `mention:${event.data.commentId}`,
  entry: (event) => ({
    variant: event.kind === 'comment:edit' ? 'edited' : 'new',
    pageId: event.data.page!.id,
    commentId: event.data.commentId ?? null,
    data: snapshotOf(event)
  })
}
