import { reactive } from 'vue'

/**
 * The listing of the blog currently on screen.
 *
 * A module singleton, because the blog is drawn in two places at once and they are one answer: the
 * article column shows the posts, and the column beside it shows the tags and the archive to narrow
 * them by. Both come out of a single request (see `api/blogs.ts` — the facets ride along with the
 * posts so that a tag cloud can never disagree with the listing next to it), so a second component
 * fetching for itself would be a second request and a second chance to disagree.
 *
 * Only one blog is ever on screen, so there is nothing to key this by: `PageBlog.vue` loads it as the
 * route settles and `reset()` empties it on the way out, the same way the page store empties itself
 * for a page that turns out not to be there.
 */

export const blogState = reactive({
  loading: false,
  /** Whether a listing has arrived, which is what separates "no posts" from "not asked yet". */
  loaded: false,
  /** Set when the request failed, so the column can say so rather than show an empty blog. */
  failed: false,
  posts: [],
  total: 0,
  page: 1,
  pageCount: 1,
  /** Every tag and month of the WHOLE blog, not of the filtered set — see `BlogListing` on the server. */
  facets: { tags: [], archive: [] },
  /** Whether the blog holds more posts than one request will read. */
  truncated: false
})

/** Empty the listing, for a reader leaving the blog. */
export function resetBlog() {
  blogState.loading = false
  blogState.loaded = false
  blogState.failed = false
  blogState.posts = []
  blogState.total = 0
  blogState.page = 1
  blogState.pageCount = 1
  blogState.facets = { tags: [], archive: [] }
  blogState.truncated = false
}

/**
 * Fetch one page of a blog's listing.
 *
 * Every narrowing is the server's: which posts this reader may open, what the tag cloud should say
 * and which page of the result they are on are all answered there, because none of them can be
 * answered here without holding posts this reader was never shown.
 *
 * @param filter `{ tag, year, month, page }`, each optional — the reader's selection as the URL
 *   carries it. See `PageBlog.vue`.
 */
export async function loadBlog({ siteId, path, locale, filter = {} }) {
  blogState.loading = true
  blogState.failed = false
  try {
    const search = new URLSearchParams({ path, locale })
    if (filter.tag) {
      search.set('tag', filter.tag)
    }
    if (filter.year) {
      search.set('year', String(filter.year))
      if (filter.month) {
        search.set('month', String(filter.month))
      }
    }
    if (filter.page && filter.page > 1) {
      search.set('page', String(filter.page))
    }
    const resp = await API_CLIENT.get(`sites/${siteId}/blogs/posts?${search.toString()}`).json()
    blogState.posts = resp.posts ?? []
    blogState.total = resp.total ?? 0
    blogState.page = resp.page ?? 1
    blogState.pageCount = resp.pageCount ?? 1
    blogState.facets = resp.facets ?? { tags: [], archive: [] }
    blogState.truncated = resp.truncated === true
    blogState.loaded = true
  } catch (err) {
    blogState.failed = true
    console.warn(err)
  }
  blogState.loading = false
}
