import { sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { AccessActor } from '../models/groups.ts'
import type { RulePageRef } from './pageRules.ts'

/**
 * Whether a page is open to its readers, and who may see it while it is not.
 *
 * A page is LIVE when it is `published`, or `scheduled` and inside its window — on or after
 * `publishStartDate` and before `publishEndDate`, either end left open when unset. A `draft` never
 * is. The dates gate a `scheduled` page only: on a `published` one `publishStartDate` is the date a
 * blog post is dated by, which an author may well set in the past or the future without meaning to
 * take the post down.
 *
 * A page that is not live is the business of the people working on it, and of nobody else: whoever
 * holds `write:pages` or `manage:pages` on it may see it, its source included, and every other
 * reader is answered as though it were not there. A request without a session never sees one —
 * anonymous readers and API keys alike — since a draft belongs to people, not to a token.
 *
 * Every read that answers a reader goes through these two, so that no route, listing or search can
 * disagree with the page view about whether a page is there.
 */

type PublishColumns = {
  publishState: PgColumn | SQL
  publishStartDate: PgColumn | SQL
  publishEndDate: PgColumn | SQL
}

/** What lets a requester see a page that is not live. */
export const UNPUBLISHED_PERMISSIONS = ['write:pages', 'manage:pages']

/**
 * The SQL condition for a page being live now.
 *
 * Decided by the database so that it is one definition wherever a page is read. Compared against an
 * ISO string cast to `timestamp`, which is how drizzle writes the two columns: they hold UTC with no
 * zone, and comparing them to `now()` would read them in the session's zone instead.
 */
export function liveCondition(columns: PublishColumns): SQL {
  const now = new Date().toISOString()
  return sql`(${columns.publishState} = 'published' OR (${columns.publishState} = 'scheduled'
    AND (${columns.publishStartDate} IS NULL OR ${columns.publishStartDate} <= ${now}::timestamp)
    AND (${columns.publishEndDate} IS NULL OR ${columns.publishEndDate} > ${now}::timestamp)))`
}

/** Whether this actor may see this page while it is not live. */
export function maySeeUnpublished(actor: AccessActor, page: RulePageRef): boolean {
  return UNPUBLISHED_PERMISSIONS.some((permission) =>
    WIKI.models.groups.checkAccess(actor, permission, page)
  )
}

/**
 * Whether this actor could see an unpublished page ANYWHERE.
 *
 * A pre-filter for listings, never the answer for a page: an actor for whom this is false is held to
 * live pages in SQL, and one for whom it is true has every row checked with `maySeeUnpublished`.
 */
export function maySeeUnpublishedAnywhere(actor: AccessActor): boolean {
  return UNPUBLISHED_PERMISSIONS.some((permission) =>
    WIKI.models.groups.grantsAnywhere(actor, permission)
  )
}
