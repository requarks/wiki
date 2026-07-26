import { sql } from 'drizzle-orm'

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
   */
  async getTags(siteId: string, { limit = 1000 }: { limit?: number } = {}): Promise<Tag[]> {
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
}

export const tags = new Tags()
