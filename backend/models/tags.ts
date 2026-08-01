import { sql } from 'drizzle-orm'
import type { AccessActor } from './groups.ts'

export interface Tag {
  tag: string
  usageCount: number
}

/**
 * Tags
 *
 * A tag is not a row anybody creates: it exists because a page carries it, in `pages.tags`. The list
 * is therefore derived rather than stored, which is what keeps it from drifting out of step with the
 * pages after an edit, a delete or a restore.
 *
 * NOTE: the `tags` table in the schema is a leftover of an earlier design and is never written to.
 * Reading from it here would answer every request with an empty list.
 */
class Tags {
  /**
   * Every tag used by a page of this site, most used first
   *
   * @param siteId Site the pages belong to
   * @param limit Ceiling on how many distinct tags come back, most used first
   * @param actor Who is asking. Given one, the list is built only from the pages they may read —
   *              a tag is the name of something on a page, and the set of tags in use tells a
   *              reader what a wiki is about. Counted over readable pages too, so the numbers agree
   *              with what a search for the tag would return.
   */
  async getTags(
    siteId: string,
    { limit = 1000, actor }: { limit?: number; actor?: AccessActor } = {}
  ): Promise<Tag[]> {
    if (!actor) {
      const result = await WIKI.db.execute(sql`
        SELECT tag, COUNT(*)::int AS "usageCount"
        FROM pages, unnest(tags) AS tag
        WHERE "siteId" = ${siteId}
        GROUP BY tag
        ORDER BY COUNT(*) DESC, tag ASC
        LIMIT ${limit}
      `)
      return ((result.rows ?? result) as any[]).map((row) => ({
        tag: row.tag as string,
        usageCount: row.usageCount as number
      }))
    }

    /*
      Aggregated here rather than in postgres, because which pages count depends on the page rules and
      a rule can be a regular expression or a set of tags — neither of which a `GROUP BY` could take
      into account. Only tagged pages are read, and only their path, locale and tags.
    */
    const result = await WIKI.db.execute(sql`
      SELECT path, locale, tags
      FROM pages
      WHERE "siteId" = ${siteId} AND array_length(tags, 1) > 0
    `)
    const counts = new Map<string, number>()
    for (const row of (result.rows ?? result) as any[]) {
      const page = {
        path: row.path as string,
        locale: row.locale as string,
        tags: (row.tags ?? []) as string[]
      }
      if (!WIKI.models.groups.checkAccess(actor, 'read:pages', page)) {
        continue
      }
      for (const tag of page.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([tag, usageCount]) => ({ tag, usageCount }))
      .sort((a, b) => b.usageCount - a.usageCount || a.tag.localeCompare(b.tag))
      .slice(0, limit)
  }
}

export const tags = new Tags()
