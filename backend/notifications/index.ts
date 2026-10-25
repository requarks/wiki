import { commentReply } from './categories/commentReply.ts'
import { feedbackStatus } from './categories/feedbackStatus.ts'
import { mention } from './categories/mention.ts'
import { pageCreated } from './categories/pageCreated.ts'
import { pageDeleted } from './categories/pageDeleted.ts'
import { pageLifecycle } from './categories/pageLifecycle.ts'
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
  feedbackStatus,
  reviewRequested,
  pageLifecycle,
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

/**
 * What an administrator lets a section deliver, for the whole instance (Admin → Notifications):
 * nothing, in-app only, or in-app and email.
 */
export const SECTION_DELIVERY_MODES = ['off', 'inApp', 'email'] as const

export type SectionDelivery = (typeof SECTION_DELIVERY_MODES)[number]

/**
 * What a section may deliver right now — `notifications.sections` in the settings.
 *
 * A master switch laid over each person's choices rather than written into them: nothing a user
 * stored is changed by it, so a section turned off and back on finds everybody's choices where they
 * left them. Which is why every place that acts on a choice asks this as well — the Profile screen
 * (what it offers), the fan-out (what it writes) and the mail drain (what it still sends).
 */
export function deliveryFor(section: NotificationSection): SectionDelivery {
  return WIKI.config.notifications.sections[section]
}

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
