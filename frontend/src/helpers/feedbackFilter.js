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
