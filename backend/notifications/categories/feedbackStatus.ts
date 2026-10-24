import { submitterAndVotersOf } from '../recipients.ts'
import { snapshotOf } from '../snapshot.ts'
import type { NotificationCategory } from '../types.ts'

/**
 * An idea the recipient submitted or voted for on a feedback board changed status.
 *
 * The variant is the status it moved TO, which is what picks the sentence (`…planned`, `…completed`)
 * — the one thing every channel has to say. The comment posted with the change, when there is one,
 * is quoted as a comment notification quotes a comment; when there is none the excerpt is set to null
 * rather than left out, or an entry still unread from an earlier change would go on quoting what was
 * said about that one.
 *
 * Highest priority of every category reacting to `feedback:status`, so that somebody who voted and was
 * also mentioned in the comment, or also watches the idea, is told the status changed rather than
 * only that somebody commented.
 */
export const feedbackStatus: NotificationCategory = {
  key: 'feedbackStatus',
  section: 'discussions',
  events: ['feedback:status'],
  scope: 'site',
  origins: ['user'],
  defaults: { inApp: true, email: true },
  priority: 45,
  recipients: submitterAndVotersOf,
  access: 'read:pages',
  // -> Per idea: two changes before the reader looks are one entry, showing where it is now
  groupKey: (event) => `feedbackStatus:${event.data.page!.id}`,
  entry: (event) => ({
    variant: event.data.statusTo ?? 'open',
    pageId: event.data.page!.id,
    commentId: event.data.commentId ?? null,
    data: {
      ...snapshotOf(event),
      excerpt: event.data.excerpt ?? null,
      statusFrom: event.data.statusFrom ?? null,
      statusTo: event.data.statusTo ?? null
    }
  })
}
