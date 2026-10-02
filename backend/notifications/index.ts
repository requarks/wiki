import { commentReply } from './categories/commentReply.ts'
import { mention } from './categories/mention.ts'
import { pageCreated } from './categories/pageCreated.ts'
import { pageDeleted } from './categories/pageDeleted.ts'
import { reviewRequested } from './categories/reviewRequested.ts'
import { watchedPage } from './categories/watchedPage.ts'
import { watchedPageComment } from './categories/watchedPageComment.ts'
import type {
  EventOrigin,
  NotificationCategory,
  NotificationEventKind,
  NotificationSection
} from './types.ts'

/**
 * The notification categories, in full.
 *
 * Closed, the way `AUDIT_ACTIONS` is: `NotificationCategoryKey` is its union, so `npm run typecheck`
 * refuses a key that is not here. Each key is also its translation prefix — the Profile screen reads
 * `notifications.categories.<key>.title` / `.description`, an entry `notifications.messages.<key>.*`
 * and a mail `mail.notification.<key>.*` — so a category added here is a set of strings added to
 * `locales/en.json` as well.
 *
 * Adding one is a file under `categories/`, a line here, an `emit()` for any event that does not
 * exist yet, and its strings. Nothing else reads a category by name.
 */
export const NOTIFICATION_CATEGORIES = {
  watchedPage,
  watchedPageComment,
  commentReply,
  mention,
  reviewRequested,
  pageCreated,
  pageDeleted
} as const satisfies Record<string, NotificationCategory>

export type NotificationCategoryKey = keyof typeof NOTIFICATION_CATEGORIES

export const NOTIFICATION_CATEGORY_KEYS = Object.keys(
  NOTIFICATION_CATEGORIES
) as NotificationCategoryKey[]

/** The order the Profile screen lists its headings in. */
export const NOTIFICATION_SECTIONS: NotificationSection[] = [
  'watching',
  'discussions',
  'reviews',
  'everything'
]

export function isCategoryKey(key: string): key is NotificationCategoryKey {
  return Object.hasOwn(NOTIFICATION_CATEGORIES, key)
}

/**
 * The categories an event concerns, highest priority first — which is the order the fan-out has to
 * write them in for the higher one to win a person both would reach.
 */
export function categoriesFor(
  kind: NotificationEventKind,
  origin: EventOrigin
): NotificationCategory[] {
  return Object.values(NOTIFICATION_CATEGORIES)
    .filter((category) => category.events.includes(kind) && category.origins.includes(origin))
    .sort((a, b) => b.priority - a.priority)
}
