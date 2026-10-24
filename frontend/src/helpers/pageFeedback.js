/**
 * How a feedback board behaves, as its front page holds it, and what an idea's status looks like.
 *
 * A board is a page authored with the `feedback` editor: a path, a title and a place in the tree, and
 * nothing to read. What an author fills in is how the board should behave, and that is its content,
 * as JSON — see `FeedbackBoardContent` and `normalizeFeedbackContent` in the backend's
 * `models/pages.ts`, which is the authority on the shape and rewrites a save into it. This file is the
 * same reading, in front of the author: the editor round-trips through it and the board view follows
 * what it returns.
 *
 * Which pages are the board's IDEAS is not here and is not stored anywhere — they are the pages in the
 * board's folder, worked out by the server at read time. See `models/feedback.ts`.
 */

/**
 * Where an idea stands, in the order an idea usually moves through them. Mirrors `FEEDBACK_STATUSES`
 * on the server; `open` is also an idea nobody has moved yet.
 */
export const FEEDBACK_STATUSES = [
  'open',
  'underReview',
  'planned',
  'inProgress',
  'completed',
  'closed'
]

/**
 * The statuses that settle an idea: done or turned down. Mirrors `SETTLED_STATUSES` on the server,
 * which refuses what they close regardless; these are what the controls follow first.
 */
export const SETTLED_STATUSES = ['completed', 'closed']

/** Whether an idea in this status may still be voted for: a settled idea keeps its count. */
export function takesVotes(status) {
  return !SETTLED_STATUSES.includes(status)
}

/**
 * Whether an idea in this status takes new comments from everybody. A settled one's discussion is
 * still shown, and only whoever may move the idea may add to it (`takesComments` on the server).
 */
export function takesComments(status) {
  return !SETTLED_STATUSES.includes(status)
}

/**
 * How each status is drawn. Literal icon names, so that the build bundles them (`npm run icons`); the
 * colour is a palette name with a `--color-*` property behind it, which `FeedbackStatusBadge.vue`
 * mixes the chip's pale tint and its darker label from.
 */
export const FEEDBACK_STATUS_LOOK = {
  open: { icon: 'mdi:lightbulb-outline', color: 'grey-7' },
  underReview: { icon: 'mdi:eye-outline', color: 'purple-6' },
  planned: { icon: 'mdi:calendar-check-outline', color: 'amber-9' },
  inProgress: { icon: 'mdi:progress-wrench', color: 'blue-8' },
  completed: { icon: 'mdi:check-circle-outline', color: 'emerald-600' },
  closed: { icon: 'mdi:close-circle-outline', color: 'red-8' }
}

/** The orders a board's listing can be read in, default first. Mirrors `FEEDBACK_SORTS`. */
export const FEEDBACK_SORTS = ['top', 'newest', 'recent', 'trending']

/** The widest a page of the listing may be set to. Mirrors `FEEDBACK_MAX_PER_PAGE` on the server. */
export const FEEDBACK_MAX_PER_PAGE = 100

/** As long an introduction as a board will carry. Mirrors `BLOG_MAX_INTRO`, which a board shares. */
export const FEEDBACK_MAX_INTRO = 2000

/** As long a submission notice as a board will carry: the introduction's ceiling, which it shares. */
export const FEEDBACK_MAX_SUBMIT_NOTICE = FEEDBACK_MAX_INTRO

/** As many categories as a board may define. Mirrors `FEEDBACK_MAX_CATEGORIES`. */
export const FEEDBACK_MAX_CATEGORIES = 50

/** As long as a category's tag or label may be. Mirrors `FEEDBACK_MAX_CATEGORY_LENGTH`. */
export const FEEDBACK_MAX_CATEGORY_LENGTH = 100

/**
 * The statuses a listing shows when the reader has picked none, which depend on how it is sorted.
 * Mirrors `defaultStatusesFor` on the server, which says why.
 */
export function defaultStatusesFor(sort) {
  const hidden = sort === 'top' || sort === 'trending' ? ['completed', 'closed'] : ['closed']
  return FEEDBACK_STATUSES.filter((status) => !hidden.includes(status))
}

/** A board with nothing filled in, which is what a page being created starts as. */
export function emptyBoard() {
  return {
    // -> See `FEEDBACK_DEFAULTS` on the server, which is the authority on every default here
    intro: '',
    categories: [],
    submitterCategories: true,
    sort: 'top',
    perPage: 20,
    acceptsIdeas: true,
    voting: true,
    submitNotice: ''
  }
}

/**
 * A board's categories as one list: tags trimmed and lowercased, labels trimmed and defaulting to the
 * tag, empty and repeated tags dropped. The server's `normalizeFeedbackCategories`, so that what the
 * editor shows after a save is what it showed before it.
 *
 * Empty tags are kept while `keepEmpty` is set, for the editor: a row somebody has just added and not
 * yet typed into is not a row to take away from under them.
 */
export function normalizeCategories(value, { keepEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set()
  const categories = []
  for (const entry of value) {
    const tag = typeof entry?.tag === 'string' ? entry.tag.trim().toLowerCase() : ''
    if (!tag && !keepEmpty) {
      continue
    }
    if (tag && seen.has(tag)) {
      continue
    }
    if (tag) {
      seen.add(tag)
    }
    const label = typeof entry?.label === 'string' && entry.label.trim() ? entry.label.trim() : tag
    categories.push({
      tag: tag.slice(0, FEEDBACK_MAX_CATEGORY_LENGTH),
      label: label.slice(0, FEEDBACK_MAX_CATEGORY_LENGTH)
    })
  }
  return categories.slice(0, FEEDBACK_MAX_CATEGORIES)
}

/**
 * Read a stored board's settings. Never throws: content that is missing or unparseable comes back as
 * an empty board, which is a working board rather than a broken screen.
 */
export function parseBoard(content) {
  let parsed = null
  try {
    parsed = JSON.parse(content ?? '')
  } catch {
    // -> An empty board is the answer; see above
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    parsed = {}
  }
  const defaults = emptyBoard()
  const perPage = Number.parseInt(parsed.perPage, 10)
  return {
    intro: typeof parsed.intro === 'string' ? parsed.intro : defaults.intro,
    categories: normalizeCategories(parsed.categories),
    submitterCategories:
      typeof parsed.submitterCategories === 'boolean'
        ? parsed.submitterCategories
        : defaults.submitterCategories,
    sort: FEEDBACK_SORTS.includes(parsed.sort) ? parsed.sort : defaults.sort,
    perPage:
      Number.isFinite(perPage) && perPage > 0
        ? Math.min(perPage, FEEDBACK_MAX_PER_PAGE)
        : defaults.perPage,
    acceptsIdeas:
      typeof parsed.acceptsIdeas === 'boolean' ? parsed.acceptsIdeas : defaults.acceptsIdeas,
    voting: typeof parsed.voting === 'boolean' ? parsed.voting : defaults.voting,
    submitNotice:
      typeof parsed.submitNotice === 'string' ? parsed.submitNotice : defaults.submitNotice
  }
}

/** The canonical spelling of a board's settings, which is what gets saved. */
export function serializeBoard(board = {}) {
  return JSON.stringify(parseBoard(JSON.stringify(board)))
}
