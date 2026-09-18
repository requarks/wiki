/**
 * What a blog listing is narrowed to, as the URL carries it.
 *
 * The selection lives in the query string rather than in the path, because the path namespace under
 * a blog belongs to its posts — `/my-blog/2026/03` is a page somebody may well have written, and an
 * archive addressed that way would collide with it. It also makes a narrowed blog a link somebody can
 * be handed, which is what `/_tags?t=a,b` does for the same reason.
 *
 * Both halves live here so that the component reading a filter and the component writing one cannot
 * disagree about the spelling: `PageBlog.vue` reads, `PageBlogSidebar.vue` writes.
 */

/**
 * Read a filter out of a route's query.
 *
 * Every field is optional and anything unreadable is simply absent — a filter is a reader's
 * selection, and a `?year=soon` typed into the bar should show them the blog rather than an error.
 * A month without a year is dropped for the same reason the server ignores it: it does not name a
 * period.
 */
export function blogFilterFromQuery(query = {}) {
  const year = Number.parseInt(query.year, 10)
  const month = Number.parseInt(query.month, 10)
  const page = Number.parseInt(query.p, 10)
  const hasYear = Number.isFinite(year) && year > 0
  const hasMonth = hasYear && Number.isFinite(month) && month >= 1 && month <= 12
  return {
    tag: typeof query.tag === 'string' && query.tag.length > 0 ? query.tag : null,
    year: hasYear ? year : null,
    month: hasMonth ? month : null,
    page: Number.isFinite(page) && page > 1 ? page : 1
  }
}

/**
 * Write a filter back into a route query, leaving out everything that is not set.
 *
 * The page is never carried across: every one of these changes WHICH posts there are, so staying on
 * page 4 of the previous selection would land the reader somewhere arbitrary in the new one — or, for
 * a narrower selection, on a page that no longer exists.
 */
export function blogFilterQuery({ tag, year, month } = {}) {
  const query = {}
  if (tag) {
    query.tag = tag
  }
  if (year) {
    query.year = String(year)
    if (month) {
      query.month = String(month)
    }
  }
  return query
}
