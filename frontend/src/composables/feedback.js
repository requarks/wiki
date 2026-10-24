import { reactive } from 'vue'

/**
 * The listing of the feedback board currently on screen.
 *
 * A module singleton for the blog's reason (`composables/blog.js`): the board is drawn in two places at
 * once — the ideas in the article column, the status and category facets in the column beside it — and
 * both come out of one request, so a count in the sidebar can never disagree with the list next to it.
 *
 * Only one board is ever on screen, so there is nothing to key this by: `PageFeedback.vue` loads it as
 * the route settles and `resetFeedback()` empties it on the way out.
 */
export const feedbackState = reactive({
  loading: false,
  /** Whether a listing has arrived, which is what separates "no ideas" from "not asked yet". */
  loaded: false,
  /** Set when the request failed, so the column can say so rather than show an empty board. */
  failed: false,
  ideas: [],
  total: 0,
  page: 1,
  pageCount: 1,
  /** The sort and statuses the server answered in, which are the defaults when none were asked for. */
  sort: 'top',
  statuses: [],
  /** Counted over every idea matching the search, before the status and category filters. */
  facets: { statuses: [], categories: [], uncategorized: 0 }
})

/** Empty the listing, for a reader leaving the board. */
export function resetFeedback() {
  feedbackState.loading = false
  feedbackState.loaded = false
  feedbackState.failed = false
  feedbackState.ideas = []
  feedbackState.total = 0
  feedbackState.page = 1
  feedbackState.pageCount = 1
  feedbackState.sort = 'top'
  feedbackState.statuses = []
  feedbackState.facets = { statuses: [], categories: [], uncategorized: 0 }
}

/**
 * Fetch one page of a board's listing.
 *
 * Every narrowing is the server's, which answers it in SQL — see `api/feedback.ts`.
 *
 * @param filter `{ q, sort, statuses, category, page }`, each optional, as `helpers/feedbackFilter.js`
 *   reads them out of the URL.
 */
export async function loadFeedback({ siteId, path, locale, filter = {} }) {
  feedbackState.loading = true
  feedbackState.failed = false
  try {
    const search = new URLSearchParams({ path, locale })
    if (filter.q?.trim()) {
      search.set('q', filter.q.trim())
    }
    if (filter.sort) {
      search.set('sort', filter.sort)
    }
    if (filter.statuses) {
      search.set('status', filter.statuses.join(','))
    }
    if (filter.category) {
      search.set('category', filter.category)
    }
    if (filter.page && filter.page > 1) {
      search.set('page', String(filter.page))
    }
    const resp = await API_CLIENT.get(`sites/${siteId}/feedback/ideas?${search.toString()}`).json()
    feedbackState.ideas = resp.ideas ?? []
    feedbackState.total = resp.total ?? 0
    feedbackState.page = resp.page ?? 1
    feedbackState.pageCount = resp.pageCount ?? 1
    feedbackState.sort = resp.sort ?? 'top'
    feedbackState.statuses = resp.statuses ?? []
    feedbackState.facets = resp.facets ?? { statuses: [], categories: [], uncategorized: 0 }
    feedbackState.loaded = true
  } catch (err) {
    feedbackState.failed = true
    console.warn(err)
  }
  feedbackState.loading = false
}

/**
 * Vote for an idea, or take the vote back — the page ratings routes, which on an idea accept nothing
 * but an upvote (`api/ratings.ts`).
 *
 * Changes the idea it is handed in place, first, and puts it back on a refusal: the button answers the
 * click at once, and the count is then taken from the server, since other readers vote too.
 *
 * @param idea Anything carrying `id`, `upvotes` and `viewerVoted` — a listing row, or a duplicate in
 *   the submission form.
 * @throws Whatever the request failed with, for the caller to report.
 */
export async function toggleVote(siteId, idea) {
  const voted = !idea.viewerVoted
  const previous = { upvotes: idea.upvotes, viewerVoted: idea.viewerVoted }
  idea.viewerVoted = voted
  idea.upvotes += voted ? 1 : -1
  try {
    const url = `sites/${siteId}/pages/${idea.id}/rating`
    const resp = await (
      voted ? API_CLIENT.put(url, { json: { value: 1 } }) : API_CLIENT.delete(url)
    ).json()
    idea.upvotes = resp.rating?.up ?? idea.upvotes
    idea.viewerVoted = resp.value === 1
  } catch (err) {
    Object.assign(idea, previous)
    throw err
  }
}
