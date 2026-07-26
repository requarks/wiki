/**
 * Recompute the search vector of every page.
 *
 * Queued from the admin area's search view, and safe to run at any time: it only rewrites `pages.ts`
 * from the content already stored on each page.
 */
export async function task(): Promise<void> {
  await WIKI.models.search.rebuildIndex()
}
