import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { pages as pagesTable, tree as treeTable, users as usersTable } from '../db/schema.ts'
import { decodeTreePath, encodeTreePath } from '../helpers/common.ts'
import { isBodylessEditor, parseBlogContent, type BlogContent } from './pages.ts'
import type { AccessActor } from './groups.ts'

/**
 * How many of a blog's posts are read out of the database for one request.
 *
 * Every post is read, not just the page of them being shown, because the ordering that matters is
 * the one that survives the page rules: which posts a reader may open cannot be expressed in SQL —
 * a rule matches on path, locale and tags and is resolved a page at a time — so a `LIMIT 10` here
 * would be ten CANDIDATES, of which this reader might see six, and page 2 would then start in the
 * wrong place. Filtering first and slicing afterwards is what makes "posts 11-20 of 47" true.
 *
 * The facets are the same read. A tag cloud and an archive counted in SQL would count posts this
 * reader may not open, which is a listing of pages they were told nothing about — the same reasoning
 * `tags.getTags` applies site-wide.
 *
 * The ceiling is what keeps that honest rather than unbounded. A blog past it is not a blog any more
 * and wants a search page; the listing says so rather than quietly serving a prefix.
 */
const MAX_POSTS = 2000

/** A blog's front page: where it is, and how its author set it up. */
export interface BlogRef {
  id: string
  /** Slash-separated path of the front page, i.e. the blog's own URL within the site. */
  path: string
  title: string
  locale: string
  settings: BlogContent
}

/** One post, as a listing draws it. */
export interface BlogPost {
  id: string
  /** Slash-separated path of the post, i.e. its URL within the site. */
  path: string
  title: string
  description: string
  /** The post's icon, as an Iconify reference. Empty when it has none. */
  icon: string
  tags: string[]
  /**
   * When the post counts as having been published: its `publishStartDate`, or when it was created.
   *
   * One field rather than two, because a blog is ordered by one thing and a reader is shown one
   * date, and a post written today about last week belongs where its author dated it.
   *
   * It is not what decides whether the post is LISTED. That is `publishState`, here as everywhere
   * else in the wiki — so a post left `published` with a start date next Tuesday is in the blog
   * today, dated next Tuesday. `scheduled` is what holds one back.
   */
  publishedAt: Date
  updatedAt: Date
  authorId: string
  /** Who wrote the version that stands. Empty once that account is deleted. */
  authorName: string
}

/** What the column beside a listing offers to narrow it by. */
export interface BlogFacets {
  /** Every tag carried by a readable post, most used first. */
  tags: { tag: string; count: number }[]
  /** One entry per month that has posts, newest first. */
  archive: { year: number; month: number; count: number }[]
}

/** A listing, as one request answers it. */
export interface BlogListing {
  posts: BlogPost[]
  /** How many posts match the filters, ignoring which page of them was asked for. */
  total: number
  /** Which page of the listing this is, counted from 1. */
  page: number
  pageCount: number
  /**
   * The facets over every readable post of the blog, NOT over the filtered set — a tag cloud that
   * emptied itself as soon as a tag was picked would leave a reader with no way back out of the
   * filter they just applied.
   */
  facets: BlogFacets
  /** Whether the blog holds more posts than one request will read. See `MAX_POSTS`. */
  truncated: boolean
}

/** What a listing may be narrowed by, as a reader picks it out of the sidebar. */
export interface BlogFilter {
  /** Only posts carrying this tag. */
  tag?: string | null
  /** Only posts published in this year, and in this month of it when one is given. */
  year?: number | null
  month?: number | null
  /** Which page of the listing to answer with, counted from 1. */
  page?: number
}

/** One candidate row, before the page rules and the nesting rule have had their say. */
interface Candidate extends BlogPost {
  editor: string
}

/**
 * Blogs
 *
 * A blog is a page written with the `blog` editor plus the pages underneath it. That is the whole of
 * the data model: the front page's content column holds how the blog should look (`BlogContent`), and
 * WHICH pages are its posts is worked out here, at read time, from where they sit.
 *
 * Nothing is written on a post to say it is one. That is deliberate and it is what makes the feature
 * cost nothing to the rest of the wiki: a post is an ordinary page with ordinary history, ordinary
 * permissions and an ordinary place in the tree, and moving it out of the blog's path is how it stops
 * being a post. The tree already supports a page and a folder sharing a name — `/my-blog` is both the
 * front page and the way into `/my-blog/…`, the same way `/guide` is — so nothing had to change there
 * either.
 *
 * The cost of that choice is that the blog's membership is a fact about PATHS, and paths move. Moving
 * the front page away from its posts, or renaming the folder out from under it, leaves a blog with
 * nothing in it and no row anywhere recording that anything is wrong. `listing` reports the empty
 * case as its own answer rather than as a listing that happens to be empty, so the failure is at
 * least legible to whoever caused it.
 */
class Blogs {
  /**
   * The blog whose front page IS this path, or null where that page is not a blog.
   *
   * One lookup on `(siteId, locale, path)`, which is a unique index.
   */
  async blogAt(siteId: string, locale: string, path: string): Promise<BlogRef | null> {
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        path: pagesTable.path,
        title: pagesTable.title,
        locale: pagesTable.locale,
        content: pagesTable.content,
        editor: pagesTable.editor
      })
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.siteId, siteId),
          eq(pagesTable.locale, locale),
          eq(pagesTable.path, path),
          eq(pagesTable.editor, 'blog')
        )
      )
      .limit(1)
    const row = rows[0]
    return row ? { ...row, settings: parseBlogContent(row.content) } : null
  }

  /**
   * The blog a page belongs to, or null for a page that is not in one.
   *
   * Asked of every page view, so it is one indexed read and not a scan: the candidates are the page's
   * own ancestors, which is a handful of paths a path already names, so the lookup is an `IN` over the
   * same unique index `blogAt` uses. A page at the site root has no ancestors and costs no query at
   * all.
   *
   * The NEAREST ancestor wins. A blog inside a blog is its own blog — its posts belong to it and not
   * to the one above, which is also what `postsFor` implements coming the other way.
   *
   * The page itself is never the answer: a blog's front page is not one of its own posts.
   */
  async blogFor(siteId: string, locale: string, path: string): Promise<BlogRef | null> {
    const parts = path.split('/').filter((part) => part.length > 0)
    if (parts.length < 2) {
      return null
    }
    const ancestors: string[] = []
    for (let i = 1; i < parts.length; i++) {
      ancestors.push(parts.slice(0, i).join('/'))
    }
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        path: pagesTable.path,
        title: pagesTable.title,
        locale: pagesTable.locale,
        content: pagesTable.content
      })
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.siteId, siteId),
          eq(pagesTable.locale, locale),
          eq(pagesTable.editor, 'blog'),
          inArray(pagesTable.path, ancestors)
        )
      )
    if (rows.length < 1) {
      return null
    }
    // -> The nearest one, which is the longest path: every row here is an ancestor of the same page
    const nearest = rows.reduce((best, row) => (row.path.length > best.path.length ? row : best))
    return { ...nearest, settings: parseBlogContent(nearest.content) }
  }

  /**
   * Make sure the folder a blog's posts will go in exists.
   *
   * A blog's front page is a page at `my-blog`, and its posts are pages at `my-blog/…` — which means
   * the folder `my-blog` is where an author is about to be working, and until something is saved
   * under it the folder is not there at all. The tree creates folders from the middle out as pages
   * arrive, so nothing is BROKEN without this: the folder appears the moment the first post is saved.
   * What is missing is somewhere to save that first post FROM — the file manager and the tree browser
   * have no folder to open, so the blog looks like a dead end until somebody types the path by hand.
   *
   * A page and a folder of the same name sit side by side quite happily — that is how `/guide` gets
   * to be both a page and the way into `/guide/…` — so this adds a folder rather than changing
   * anything about the page.
   *
   * **It never fails the caller.** The folder is a convenience and the blog is complete without it,
   * so the two ways this can legitimately not work are logged and stepped over rather than raised:
   * a folder name is held to `[a-z0-9-]` while a page path may also carry underscores (a blog at
   * `my_blog` has no legal folder name), and an ASSET already sitting at that name blocks a folder
   * where it would not have blocked the page.
   *
   * @returns Whether a folder was created. False when one was already there, and when one could not be.
   */
  async ensureFolder({
    siteId,
    locale,
    path,
    title
  }: {
    siteId: string
    locale: string
    path: string
    title: string
  }): Promise<boolean> {
    const encoded = encodeTreePath(path)
    const parts = encoded.split('.')
    const fileName = parts.at(-1)!
    const folderPath = parts.slice(0, -1).join('.')

    /*
      Asked directly rather than through `tree.getFolder({ createIfMissing: true })`, which would find
      or create in one call: that one titles what it creates after the path segment, and this folder
      IS the blog — `Engineering Notes` is what somebody making it by hand would have called it, and
      the title is what the file manager and the browse menu show.
    */
    const existing = await WIKI.db
      .select({ id: treeTable.id })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          eq(treeTable.folderPath, folderPath),
          eq(treeTable.fileName, fileName),
          eq(treeTable.type, 'folder')
        )
      )
      .limit(1)
    if (existing.length > 0) {
      return false
    }

    try {
      await WIKI.models.tree.createFolder({
        parentPath: decodeTreePath(folderPath) ?? '',
        pathName: fileName,
        title,
        locale,
        siteId
      })
      return true
    } catch (err: any) {
      WIKI.logger.warn(
        `Could not create the folder for the blog at /${path}: ${err.message}. Posts saved under it will create it.`
      )
      return false
    }
  }

  /**
   * Every post of a blog this reader may open, newest or oldest first as the blog is set up.
   *
   * Three things are dropped on the way, and each for its own reason:
   *
   * - **A page with no body of its own** — a redirection, or the front page of a blog nested inside
   *   this one. A doorway is not a post, and neither is another blog.
   * - **A page under a nested blog.** Its own blog lists it; this one stops where that one starts, so
   *   a post never appears in two listings under two different bylines.
   * - **A page the reader may not open**, by the same rule the page view applies. Filtered here rather
   *   than in SQL because a page rule is not a `WHERE` clause.
   *
   * @param publicOnly Restrict to what a reader with no session may see, i.e. published posts only.
   */
  async postsFor({
    siteId,
    blog,
    actor,
    publicOnly = true
  }: {
    siteId: string
    blog: BlogRef
    actor?: AccessActor
    publicOnly?: boolean
  }): Promise<{ posts: BlogPost[]; truncated: boolean }> {
    const encodedPath = encodeTreePath(blog.path)
    const depth = blog.settings.depth
    const levels = depth > 0 ? `*{,${depth}}` : '*{0}'
    const pathQuery = encodedPath ? `${encodedPath}.${levels}` : levels

    /*
      `publishStartDate` when the author gave one and the creation date otherwise, which is the one
      date a blog orders by and shows. Computed in SQL so the order it produces is the order the rows
      arrive in, and `MAX_POSTS` therefore cuts the far end of the blog rather than an arbitrary set.

      `mapWith` and not a bare `sql<Date>`: that generic is an assertion and nothing more, so without
      a mapper the driver hands back postgres's own `2026-08-22 09:00:00` and every caller downstream
      gets a string where the column beside it is a `Date`. Mapped through `updatedAt`, which is the
      same `timestamp` type, so both dates on a post are the same kind of value.
    */
    const publishedAt =
      sql<Date>`coalesce(${pagesTable.publishStartDate}, ${pagesTable.createdAt})`.mapWith(
        pagesTable.updatedAt
      )
    const conditions: (SQL | undefined)[] = [
      eq(treeTable.siteId, siteId),
      eq(treeTable.locale, blog.locale),
      eq(treeTable.type, 'page'),
      sql`${treeTable.folderPath} ~ ${pathQuery}::lquery`
    ]
    if (publicOnly) {
      conditions.push(eq(pagesTable.publishState, 'published'))
    }

    const rows = await WIKI.db
      .select({
        id: treeTable.id,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        title: treeTable.title,
        tags: treeTable.tags,
        description: pagesTable.description,
        icon: pagesTable.icon,
        editor: pagesTable.editor,
        updatedAt: pagesTable.updatedAt,
        authorId: pagesTable.authorId,
        authorName: usersTable.name,
        publishedAt
      })
      .from(treeTable)
      .innerJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .leftJoin(usersTable, eq(usersTable.id, pagesTable.authorId))
      .where(and(...conditions))
      .orderBy(blog.settings.sort === 'oldest' ? sql`${publishedAt} asc` : sql`${publishedAt} desc`)
      .limit(MAX_POSTS + 1)

    const truncated = rows.length > MAX_POSTS
    const candidates: Candidate[] = rows.slice(0, MAX_POSTS).map((row) => {
      const folderPath = decodeTreePath(row.folderPath ?? '') ?? ''
      return {
        id: row.id,
        path: folderPath ? `${folderPath}/${row.fileName}` : row.fileName,
        title: row.title,
        description: row.description ?? '',
        icon: row.icon ?? '',
        tags: row.tags ?? [],
        editor: row.editor,
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
        authorId: row.authorId,
        authorName: row.authorName ?? ''
      }
    })

    /*
      Where this blog stops. A blog nested inside this one owns everything below it, so the outer
      listing ends at its front page — otherwise the same post appears in two blogs, dated and
      attributed by two sets of settings that need not agree.
    */
    const nestedRoots = candidates
      .filter((row) => row.editor === 'blog')
      .map((row) => `${row.path}/`)

    const posts = candidates.filter((row) => {
      if (isBodylessEditor(row.editor)) {
        return false
      }
      if (nestedRoots.some((root) => row.path.startsWith(root))) {
        return false
      }
      if (!actor) {
        return true
      }
      return WIKI.models.groups.checkAccess(actor, 'read:pages', {
        siteId,
        path: row.path,
        locale: blog.locale,
        tags: row.tags
      })
    })

    // -> Which editor wrote a post is how it was filtered, not something a listing shows
    return {
      posts: posts.map((post) => ({
        id: post.id,
        path: post.path,
        title: post.title,
        description: post.description,
        icon: post.icon,
        tags: post.tags,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        authorId: post.authorId,
        authorName: post.authorName
      })),
      truncated
    }
  }

  /**
   * Count what the sidebar offers to narrow a listing by.
   *
   * Over the posts as they were handed in, which is to say over the posts this reader may open: a
   * count is a statement about how many pages exist, and one that included pages they were never
   * shown would be answering a question they did not ask about content they cannot reach.
   */
  facetsFor(posts: BlogPost[]): BlogFacets {
    const tagCounts = new Map<string, number>()
    const monthCounts = new Map<string, number>()
    for (const post of posts) {
      for (const tag of post.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
      const at = new Date(post.publishedAt)
      // -> UTC, because the stored instant is: a blog's archive must not put a post in a different
      //    month for a reader in a different place, and the server's own zone is nobody's
      const key = `${at.getUTCFullYear()}-${at.getUTCMonth() + 1}`
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
    }
    return {
      tags: [...tagCounts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      archive: [...monthCounts.entries()]
        .map(([key, count]) => {
          const [year, month] = key.split('-')
          return { year: Number(year), month: Number(month), count }
        })
        .sort((a, b) => b.year - a.year || b.month - a.month)
    }
  }

  /**
   * One page of a blog's listing, with the facets beside it.
   *
   * The whole answer to one request: the posts to draw, where the reader is in the blog, and what
   * the sidebar should offer. Read once and narrowed in memory — see `MAX_POSTS` for why the filters
   * are not a `WHERE` clause.
   */
  async listing({
    siteId,
    blog,
    actor,
    publicOnly = true,
    filter = {}
  }: {
    siteId: string
    blog: BlogRef
    actor?: AccessActor
    publicOnly?: boolean
    filter?: BlogFilter
  }): Promise<BlogListing> {
    const { posts: readable, truncated } = await this.postsFor({ siteId, blog, actor, publicOnly })
    const facets = this.facetsFor(readable)

    const matching = readable.filter((post) => {
      if (filter.tag && !post.tags.includes(filter.tag)) {
        return false
      }
      if (filter.year) {
        const at = new Date(post.publishedAt)
        if (at.getUTCFullYear() !== filter.year) {
          return false
        }
        if (filter.month && at.getUTCMonth() + 1 !== filter.month) {
          return false
        }
      }
      return true
    })

    const perPage = blog.settings.perPage
    const pageCount = Math.max(1, Math.ceil(matching.length / perPage))
    // -> Clamped rather than answered empty: a `?p=99` typed into the bar, or left over from a filter
    //    that used to have more pages, should land on the last page of the blog and not on nothing
    const page = Math.min(Math.max(1, Math.trunc(filter.page ?? 1)), pageCount)

    return {
      posts: matching.slice((page - 1) * perPage, page * perPage),
      total: matching.length,
      page,
      pageCount,
      facets,
      truncated
    }
  }
}

export const blogs = new Blogs()
