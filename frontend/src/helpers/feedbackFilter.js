import { FEEDBACK_SORTS, FEEDBACK_STATUSES } from '@/helpers/pageFeedback'

/**
 * What a feedback board's listing is narrowed to, as the URL carries it.
 *
 * In the query string rather than the path, for the blog's reason (`helpers/blogFilter.js`): the path
 * namespace under a board belongs to its ideas. It also makes a search of the board a link somebody
 * can be handed — "is my idea already here" is a question people answer for each other.
 *
 * Both halves live here so that the component reading a filter and the components writing one cannot
 * disagree about the spelling: `PageFeedback.vue` reads and writes the search and the sort,
 * `PageFeedbackSidebar.vue` the status and the category.
 */

/**
 * Read a filter out of a route's query.
 *
 * Every field is optional and anything unreadable is simply absent — a filter is a reader's selection,
 * and a `?sort=best` typed into the bar should show them the board rather than an error.
 *
 * `statuses` is null when the reader has not picked any, which is different from having picked all six:
 * null follows the sort (`defaultStatusesFor`), and a choice made by hand does not.
 */
export function feedbackFilterFromQuery(query = {}) {
  const page = Number.parseInt(query.p, 10)
  let statuses = null
  if (query.status === 'all') {
    statuses = [...FEEDBACK_STATUSES]
  } else if (typeof query.status === 'string' && query.status.length > 0) {
    const picked = query.status.split(',').filter((status) => FEEDBACK_STATUSES.includes(status))
    statuses = picked.length > 0 ? picked : null
  }
  return {
    q: typeof query.q === 'string' ? query.q : '',
    sort: FEEDBACK_SORTS.includes(query.sort) ? query.sort : null,
    statuses,
    category:
      typeof query.category === 'string' && query.category.length > 0 ? query.category : null,
    page: Number.isFinite(page) && page > 1 ? page : 1
  }
}

/**
 * Write a filter back into a route query, leaving out everything that is not set.
 *
 * The page is never carried across: every one of these changes WHICH ideas there are, so staying on
 * page 4 of the previous selection would land the reader somewhere arbitrary in the new one.
 */
export function feedbackFilterQuery({ q, sort, statuses, category } = {}) {
  const query = {}
  if (q) {
    query.q = q
  }
  if (sort) {
    query.sort = sort
  }
  if (statuses) {
    query.status = statuses.length === FEEDBACK_STATUSES.length ? 'all' : statuses.join(',')
  }
  if (category) {
    query.category = category
  }
  return query
}

/** Whether a filter narrows or orders the listing at all, as against the board as it opens. */
export function hasFeedbackSelection({ q, sort, statuses, category } = {}) {
  return Boolean(q || sort || statuses || category)
}

/**
 * The selection a reader made on a board -- its sort, statuses and category -- kept for the rest of
 * their browser session.
 *
 * The URL is still what the listing is read in; this only fills in a board URL that arrives with no
 * selection at all, so that a link back to the board -- an idea's own "back to the board", the
 * breadcrumbs -- does not drop the reader into the board's defaults every time they come back from an
 * idea. A URL that carries any selection is a link somebody meant, and is shown as it is.
 *
 * Kept per board, by the board's page id, since each board has its own default sort and categories.
 * Only what the reader picks is remembered, never what merely arrived in a link they were handed, and
 * the search is not remembered at all. Stored in its query-string form and read back through
 * `feedbackFilterFromQuery`, so that a value the board no longer accepts is simply dropped.
 *
 * `sessionStorage` can be unavailable or throw (a private window, blocked site data), in which case
 * there is simply nothing remembered.
 */
const SELECTION_KEY_PREFIX = 'feedback-selection:'

/** The remembered selection as route query fields, or null when there is none. */
export function rememberedFeedbackSelection(boardId) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(`${SELECTION_KEY_PREFIX}${boardId}`))
    if (!stored || typeof stored !== 'object') {
      return null
    }
    const { sort, statuses, category } = feedbackFilterFromQuery(stored)
    const query = feedbackFilterQuery({ sort, statuses, category })
    return Object.keys(query).length > 0 ? query : null
  } catch {
    return null
  }
}

/** Remember the sort, statuses and category of `filter`, or forget them when it sets none. */
export function rememberFeedbackSelection(boardId, { sort, statuses, category } = {}) {
  const query = feedbackFilterQuery({ sort, statuses, category })
  try {
    if (Object.keys(query).length > 0) {
      sessionStorage.setItem(`${SELECTION_KEY_PREFIX}${boardId}`, JSON.stringify(query))
    } else {
      sessionStorage.removeItem(`${SELECTION_KEY_PREFIX}${boardId}`)
    }
  } catch {
    // -> Nothing remembered, which only costs the reader their selection on the way back
  }
}
