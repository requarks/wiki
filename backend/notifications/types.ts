import type { RulePageRef } from '../helpers/pageRules.ts'

/**
 * The events a notification can be about. Every one of them has a `notifications.emit()` call
 * somewhere in the server; add the call in the same change that adds a key here.
 */
export const NOTIFICATION_EVENT_KINDS = [
  'page:create',
  'page:edit',
  'page:rename',
  'page:delete',
  'submission:new',
  'comment:new',
  'comment:edit'
] as const

export type NotificationEventKind = (typeof NOTIFICATION_EVENT_KINDS)[number]

/**
 * How an event came about, which a category may decline to fire for.
 *
 * `import` is anything adopted from outside — a storage target's import, a git pull, a backup being
 * restored. `bulk` is one action that removes many pages at once — a folder, a tag. `user` is
 * everything else: somebody doing one thing to one page.
 */
export const EVENT_ORIGINS = ['user', 'import', 'bulk'] as const

export type EventOrigin = (typeof EVENT_ORIGINS)[number]

/** The channels a notification can be delivered on, which is also what a preference row names. */
export const NOTIFICATION_CHANNELS = ['inApp', 'email'] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

/** A page as an event remembers it: what an entry displays, and what access is checked against. */
export interface PageSnapshot {
  id: string
  title: string
  path: string
  locale: string
  tags: string[]
  publishState: string
}

/**
 * What an event carries, beyond who and where.
 *
 * One shape for every kind rather than one per kind: an event is written by the request process and
 * read by a worker thread, through a JSONB column, so nothing about it is checked on the way anyway.
 * Each field says which kinds set it.
 */
export interface NotificationEventData {
  /** What happened: `edited`, `moved`, `deleted`, `created`, `new`, … Every kind sets it. */
  variant: string
  /** Every page event, and the page a comment or a suggestion is on. */
  page?: PageSnapshot
  /** `page:edit`: everything the save did, of which `variant` is the one that leads. */
  variants?: string[]
  /** `page:rename`: where the page was before. */
  previousPath?: string
  previousLocale?: string
  /**
   * Who did it, as they were called at the time. Also the only name a guest has — a guest comment or
   * suggestion has no actor id.
   */
  actorName?: string | null
  /** `comment:*` */
  commentId?: string
  /** `comment:new`: the thread it answers, and who started it. */
  parentId?: string | null
  parentAuthorId?: string | null
  /** `comment:*`: the first few lines, as typed. Markdown, never HTML. */
  excerpt?: string
  /** `comment:*`: the handles written in it, lowercased. On an edit, only the ones that are new. */
  mentionHandles?: string[]
  /** `submission:new` */
  submissionId?: string
}

/** An event as the fan-out reads it back out of the outbox. */
export interface NotificationEvent {
  id: string
  kind: NotificationEventKind
  origin: EventOrigin
  siteId: string | null
  actorId: string | null
  data: NotificationEventData
  recipients: string[] | null
}

/** What one entry in somebody's inbox is made of, as a category describes it for an event. */
export interface NotificationEntry {
  variant: string
  pageId?: string | null
  commentId?: string | null
  /** The snapshot the inbox and the email are drawn from. */
  data: Record<string, unknown>
}

/** The headings the Profile screen groups the categories under. */
export type NotificationSection = 'watching' | 'discussions' | 'reviews' | 'everything'

/**
 * One kind of notification: who it goes to, what it says, and how it is offered.
 *
 * A category is a file under `notifications/categories/` and a key in `NOTIFICATION_CATEGORIES`.
 * Everything that is the same for every category — leaving the actor out, checking access, applying
 * preferences, deduplicating, coalescing, mailing — is done once by the fan-out, so a category only
 * says what is particular to it.
 */
export interface NotificationCategory {
  /** Also the preference key and the translation prefix (`notifications.categories.<key>.*`). */
  key: string
  section: NotificationSection
  events: readonly NotificationEventKind[]
  /**
   * `site` for something that happened on a site, `instance` for something that belongs to none (an
   * account being created). An instance entry has no `siteId`, ignores the site switch, and is shown
   * in every site's inbox.
   */
  scope: 'site' | 'instance'
  /** Which origins this fires for. A category that leaves `import` out is silent during an import. */
  origins: readonly EventOrigin[]
  defaults: Record<NotificationChannel, boolean>
  /**
   * Which category wins when one event reaches the same person more than once — a comment that
   * mentions somebody watching the page. The higher one is sent and the lower one is not.
   */
  priority: number
  /** Whether the Profile screen offers this category to someone. Every launch category is offered. */
  visibleTo?: (actor: { permissions: string[] }) => boolean
  /** Whether this particular event concerns the category at all, e.g. a reply needs a parent. */
  appliesTo?: (event: NotificationEvent) => boolean
  /**
   * The people who may need to hear about it, in batches, **sorted by id and each batch strictly
   * after `after`**: the last id of a batch is the cursor an interrupted fan-out carries on from.
   *
   * Candidates only. The fan-out takes the actor out, checks access and applies preferences.
   */
  recipients: (event: NotificationEvent, after: string | null) => AsyncIterable<string[]>
  /**
   * The page permission a recipient must hold, at the time they are told, on the page the event is
   * about. Null when being a candidate is itself the grant — a reviewer is named by the rule.
   */
  access: string | null
  groupKey: (event: NotificationEvent) => string
  entry: (event: NotificationEvent) => NotificationEntry
}

/** The page an event is about, in the form an access rule is checked against. */
export function rulePageOf(event: NotificationEvent): RulePageRef | null {
  const page = event.data.page
  if (!page || !event.siteId) {
    return null
  }
  return { siteId: event.siteId, path: page.path, locale: page.locale, tags: page.tags ?? [] }
}
