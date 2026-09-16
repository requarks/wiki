import NodeCache from 'node-cache'
import { asc, gt } from 'drizzle-orm'
import { pages as pagesTable } from '../../db/schema.ts'
import { locales } from '../../models/locales.ts'
import { pageLinks } from '../../models/pageLinks.ts'
import { pages } from '../../models/pages.ts'
import { settings } from '../../models/settings.ts'
import { sites } from '../../models/sites.ts'

/**
 * Work out what every page on the wiki links to, from scratch.
 *
 * The links of a page are derived from its stored render and rewritten whenever that render is, so
 * ordinary editing keeps them current on its own. This is for the cases where there was nothing to
 * derive them from at the time: pages that predate the table, and a wiki whose locale prefixes or
 * page extensions changed, which silently changes what a link that was already written ADDRESSES.
 *
 * Offered under Admin → Utilities and never run on its own. It is not a migration and not a boot step:
 * a wiki with no links recorded works, it simply has no backlinks to show yet, and a rebuild that ran
 * itself on every start would re-read every render in the wiki to produce what is usually the same
 * rows.
 *
 * **In a worker thread**, which is what this file being here means — `addJob` sends a task with no
 * in-process implementation to the pool. A wiki's pages are its whole content, and parsing every
 * render in the instance is minutes of CPU on a large one: on the main thread that is the event loop
 * not serving pages for the duration.
 *
 * The price is that a worker starts with nothing but config and a logger (see `worker.ts`), and
 * resolving a link needs rather more than that — which is what `prepare` below is for.
 */

/** How many pages are read at once. A render is a whole page of HTML, so this is a memory ceiling. */
const BATCH_SIZE = 50

/**
 * Put back the parts of the `WIKI` global that reading a link needs.
 *
 * A worker thread is deliberately bare, and what an href means is decided against a good deal of
 * instance state: which hostname belongs to which site, what a site's locale prefixes and page
 * extensions are, and what short code each locale answers to. All of it is loaded here exactly as
 * `postBoot` loads it on the main thread.
 *
 * Only the four models involved, rather than the whole registry — `WIKI.models` is what `reloadCache`
 * and the resolver reach through, and importing the rest would pull the storage, search and mail
 * models into a thread that is reading HTML.
 */
async function prepare(): Promise<void> {
  await WIKI.ensureDb!()
  WIKI.cache = new NodeCache({ checkperiod: 0 })
  WIKI.models = { settings, locales, pages, pageLinks } as typeof WIKI.models
  // -> Locales first: the site cache reads nothing from them, but a site's URL prefixes are resolved
  //    through the locale cache the moment the first link is read
  await locales.reloadCache()
  await sites.reloadCache()
}

export async function task(): Promise<void> {
  await prepare()

  let cursor: string | null = null
  let processed = 0

  WIKI.logger.info('Rebuilding page links...')
  for (;;) {
    /*
      Walked by id rather than by offset: this reads every page in the wiki one batch at a time, and a
      paged read that re-counts its way to each batch gets slower as it goes. Nothing is being written
      to `pages` here, so the set is stable underneath it.
    */
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        siteId: pagesTable.siteId,
        locale: pagesTable.locale,
        path: pagesTable.path,
        editor: pagesTable.editor,
        content: pagesTable.content,
        relations: pagesTable.relations,
        render: pagesTable.render
      })
      .from(pagesTable)
      .where(cursor ? gt(pagesTable.id, cursor) : undefined)
      .orderBy(asc(pagesTable.id))
      .limit(BATCH_SIZE)

    if (rows.length < 1) {
      break
    }
    for (const row of rows) {
      /*
        One page at a time, and one failure does not stop the rest: this is a repair, and stopping at
        the first page whose render will not parse would leave the wiki with the half of its links it
        already had plus however far this got.
      */
      try {
        await pageLinks.refreshForPage(row)
      } catch (err: any) {
        WIKI.logger.warn(`Could not rebuild the links of page ${row.id}: ${err.message}`)
      }
      processed++
    }
    cursor = rows.at(-1)!.id
  }

  WIKI.logger.info(`Rebuilt the links of ${processed} page(s) [ COMPLETED ]`)
}
