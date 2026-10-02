import { only } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * Somebody answered a comment the recipient wrote.
 *
 * Only the author of the comment that started the thread — replies are one level deep, so every
 * answer in a thread is an answer to it. Others who replied in the thread are not told: following a
 * whole discussion is what watching the page is for. A guest's comment has no account to tell.
 */
export const commentReply: NotificationCategory = {
  key: 'commentReply',
  section: 'discussions',
  events: ['comment:new'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: true, email: true },
  priority: 30,
  appliesTo: (event) => Boolean(event.data.parentId && event.data.parentAuthorId),
  recipients: (event, after) => only(event.data.parentAuthorId, after),
  access: 'read:comments',
  groupKey: (event) => `reply:${event.data.parentId}`,
  entry: (event) => ({
    variant: event.data.variant,
    pageId: event.data.page!.id,
    commentId: event.data.commentId ?? null,
    data: snapshotOf(event)
  })
}
