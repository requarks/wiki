import { and, count, desc, eq, gte, inArray, ne, notInArray, or, sql, type SQL } from 'drizzle-orm'
import {
  feedbackStatuses as statusesTable,
  pageRatings as ratingsTable,
  pages as pagesTable,
  tree as treeTable,
  users as usersTable
} from '../db/schema.ts'
import { CustomError, durationToSeconds, encodeTreePath } from '../helpers/common.ts'
import type { RulePageRef } from '../helpers/pageRules.ts'
import { liveCondition } from '../helpers/publishing.ts'
import type { CommentEntry } from './comments.ts'
import {
  FEEDBACK_EDITOR,
  bodylessEditors,
  isBodylessEditor,
  parseFeedbackContent,
  type FeedbackBoardContent,
  type FeedbackSort
} from './pages.ts'

/**
 * Where an idea stands, in the order an idea usually moves through them. `open` is also what an idea
 * with no row in `feedbackStatuses` is.
 */
export const FEEDBACK_STATUSES = [
  'open',
  'underReview',
  'planned',
  'inProgress',
  'completed',
  'closed'
] as const

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

/**
 * The page icon every idea is created with. Its author can change it afterwards like any page's;
 * nothing reads it back to decide whether a page is an idea.
 */
export const IDEA_ICON = 'mdi:lightbulb-on-outline'

/** How far back the Trending sort counts upvotes. Fixed: not a board setting. */
export const TRENDING_WINDOW_DAYS = 14

/**
 * How long an account waits between two submissions when the site's setting cannot be read, in
 * seconds: one idea a minute. What a site has set is `editors.feedback.config.submissionInterval`,
 * under Admin → Editors → Feedback Board Editor -- see `submissionIntervalFor`.
 */
const DEFAULT_SUBMISSION_INTERVAL = 60

/** How many ideas the duplicate check offers while somebody types a title. */
const SIMILAR_LIMIT = 5

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly unknown[]).includes(value)
}

/**
 * The statuses that settle an idea: it has been done or turned down, and is finished with. Mirrored
 * as `SETTLED_STATUSES` in the frontend's `helpers/pageFeedback.js`. Two things close on it, each
 * asked through its own question below so that either can change without the other.
 */
export const SETTLED_STATUSES: readonly FeedbackStatus[] = ['completed', 'closed']

/**
 * Whether an idea in this status may still be voted for, either way: a settled idea keeps the count
 * it was settled at. Withdrawing a vote is refused as well as casting one, as the board's own voting
 * switch refuses both, so that the number cannot drift afterwards.
 */
export function takesVotes(status: FeedbackStatus): boolean {
  return !SETTLED_STATUSES.includes(status)
}

/**
 * Whether an idea in this status takes new comments from everybody. A settled idea's discussion is
 * kept and still read, but only whoever may move the idea (`review:pages` or `manage:pages` at the
 * board) may add to it -- the answer to a question asked afterwards, or the reason it was reopened.
 * The caller asks that permission; see `api/comments.ts`.
 */
export function takesComments(status: FeedbackStatus): boolean {
  return !SETTLED_STATUSES.includes(status)
}

/**
 * The statuses a listing shows when the reader has picked none, which depend on how it is sorted.
 *
 * Closed is never shown unasked: it is the board saying no, and a reader looking at a board wants
 * what is still possible. Completed is left out of Top and Trending too, which are read to see what to
 * work on next — done work at the top of those buries it — and kept in Newest and Recent Activity,
 * where something having just shipped is news.
 */
export function defaultStatusesFor(sort: FeedbackSort): FeedbackStatus[] {
  const hidden: FeedbackStatus[] =
    sort === 'top' || sort === 'trending' ? ['completed', 'closed'] : ['closed']
  return FEEDBACK_STATUSES.filter((status) => !hidden.includes(status))
}

/** A board's front page, as the in-memory list holds it. */
export interface BoardRef {
  id: string
  siteId: string
  locale: string
  /** Slash-separated path of the front page, which is also the folder its ideas sit in. */
  path: string
  title: string
  /** The front page's own tags, which are what a tag rule is matched against for the whole board. */
  tags: string[]
  settings: FeedbackBoardContent
}

/** Where an idea stands, and who put it there. */
export interface IdeaStatus {
  status: FeedbackStatus
  /** Null for an idea nobody has moved yet. */
  updatedAt: Date | null
  updatedById: string | null
  updatedByName: string | null
  /** The comment posted with the latest change, while it exists. */
  commentId: string | null
}

/** One idea, as a listing draws it. */
export interface FeedbackIdea {
  id: string
  path: string
  title: string
  description: string
  status: FeedbackStatus
  /** The board's categories this idea carries, in the board's order. */
  categories: string[]
  tags: string[]
  upvotes: number
  viewerVoted: boolean
  commentsCount: number
  /** Who submitted it, which on a board is the page's creator rather than its last editor. */
  authorId: string
  authorName: string
  createdAt: Date
  lastActivityAt: Date
}

/** What the column beside a listing offers to narrow it by, counted over every idea matching `q`. */
export interface FeedbackFacets {
  statuses: { status: FeedbackStatus; count: number }[]
  categories: { tag: string; label: string; count: number }[]
  uncategorized: number
}

/** What a listing may be narrowed and ordered by, as the reader picks it. */
export interface FeedbackFilter {
  q?: string | null
  sort?: FeedbackSort | null
  /** Null or absent for the default of the sort (`defaultStatusesFor`). */
  statuses?: FeedbackStatus[] | null
  /** One category tag, or `none` for the ideas carrying none of the board's categories. */
  category?: string | null
  page?: number
}

/** One page of a board's listing. */
export interface FeedbackListing {
  ideas: FeedbackIdea[]
  /** How many ideas match the filters, ignoring which page was asked for. */
  total: number
  page: number
  pageCount: number
  /** The sort the listing was answered in, which is the board's own when none was asked for. */
  sort: FeedbackSort
  /** The statuses it was narrowed to, which are the sort's default when none were asked for. */
  statuses: FeedbackStatus[]
  facets: FeedbackFacets
}

/** What reading a board's ideas needs to know about who is reading. */
interface Reader {
  /** The reader's account, for whether they voted. Null for a guest. */
  viewerId: string | null
  /**
   * Whether this reader may see ideas that are not live. One answer for the whole board, because
   * the page rules are resolved at the board for every idea in it — see `ruleRefFor`.
   */
  seeUnpublished: boolean
}

/** A transaction, as the comments model accepts one. */
type Transaction = Parameters<Parameters<typeof WIKI.db.transaction>[0]>[0]

/**
 * Feedback boards
 *
 * A board is a page written with the `feedback` editor, and its ideas are the pages in its folder —
 * the blog's model (`models/blogs.ts`), flattened to one level. What a board adds is a status per
 * idea (`feedbackStatuses`), upvotes (thumbs-up `pageRatings`), and one rule a blog does not have:
 *
 * **Access is the board's, all or nothing.** Every page permission on anything at or under a board's
 * path is decided by the rules as they apply to the board's own front page — its path and its tags —
 * and a rule written for a path below it, or a tag rule matching an idea's own tags, is never
 * consulted. `ruleRefFor` is what makes that true, and `groups.checkAccess` asks it before resolving
 * any rule, so the page view, search, the sitemap, the tree, MCP and comments all agree without each
 * having to know. The board list it reads is held in memory here for that reason: `checkAccess` is
 * asked once per row by search and by the tree, and cannot cost a query.
 *
 * That one decision per board is also what lets the listing be answered in SQL — filtered, counted,
 * sorted and paged by the database — where a blog's listing has to read every post and filter it in
 * code against rules that could differ from one post to the next.
 */
class Feedback {
  /** Every board, by `siteId:locale`, shortest path first so the outermost of two nested ones wins. */
  #boards = new Map<string, BoardRef[]>()

  // == THE BOARD LIST =================

  /**
   * Read every board back out of the database.
   *
   * Off the partial index on `pages (siteId) WHERE editor = 'feedback'`, so this is a handful of rows
   * however large the wiki is — which is what makes it affordable to call after every change that
   * could touch one.
   */
  async reloadBoards(): Promise<void> {
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        siteId: pagesTable.siteId,
        locale: pagesTable.locale,
        path: pagesTable.path,
        title: pagesTable.title,
        tags: pagesTable.tags,
        content: pagesTable.content
      })
      .from(pagesTable)
      .where(eq(pagesTable.editor, FEEDBACK_EDITOR))
    const boards = new Map<string, BoardRef[]>()
    for (const row of rows) {
      // -> A board at the site root would be a board over the whole site; the tree has no page
      //    there to be one, so a row claiming it is something else and is left out
      if (!row.path) {
        continue
      }
      const key = `${row.siteId}:${row.locale}`
      const list = boards.get(key) ?? []
      list.push({
        id: row.id,
        siteId: row.siteId,
        locale: row.locale,
        path: row.path,
        title: row.title,
        tags: row.tags ?? [],
        settings: parseFeedbackContent(row.content)
      })
      boards.set(key, list)
    }
    for (const list of boards.values()) {
      list.sort((a, b) => a.path.length - b.path.length)
    }
    this.#boards = boards
  }

  /**
   * Reload the board list here, and tell every other instance of an HA set to do the same.
   *
   * Access depends on it, so an instance that never heard of a new board would go on resolving the
   * pages under it by their own paths. `reloadBoards` itself does not emit, or two instances would
   * answer each other for ever — the same arrangement as `sites.reloadCacheEverywhere`.
   */
  async reloadBoardsEverywhere(): Promise<void> {
    await this.reloadBoards()
    WIKI.events.outbound.emit('reloadFeedbackBoards')
  }

  /**
   * Called by every page mutation with the editor of the page it touched: a board's front page being
   * created, edited (its tags and settings are in the list), moved, deleted or restored changes the
   * list, and nothing else does. Folder operations call `reloadBoardsEverywhere` outright, since a
   * board may be anywhere under the folder they move.
   */
  async pageChanged(editor: string | null | undefined): Promise<void> {
    if (editor === FEEDBACK_EDITOR) {
      await this.reloadBoardsEverywhere()
    }
  }

  /** The board whose front page IS this path, from the in-memory list. */
  boardAt(siteId: string, locale: string, path: string): BoardRef | null {
    return this.#boards.get(`${siteId}:${locale}`)?.find((board) => board.path === path) ?? null
  }

  /**
   * The board a page is an idea of, or null.
   *
   * An idea is a page directly in a board's folder that has a body of its own, so this is "is the
   * parent path a board", answered from memory. A redirection or a nested blog's front page in the
   * same folder is not an idea; pass the page's `editor` to have those answered null.
   */
  boardOfIdea(siteId: string, locale: string, path: string, editor?: string): BoardRef | null {
    if (editor && isBodylessEditor(editor)) {
      return null
    }
    const parent = path.split('/').filter(Boolean).slice(0, -1).join('/')
    return parent ? this.boardAt(siteId, locale, parent) : null
  }

  /**
   * The reference a page rule is matched against, for something at this path.
   *
   * For anything at or under a board — the board itself, its ideas, a sub-folder, an attachment, a
   * blog nested inside it and all of that blog's posts — it is the board's own front page: its path
   * and its tags. For a board inside a board it is the OUTER one, which is what "everything in the
   * board" means. Everything else is answered with the reference it came in as.
   *
   * A reference without a locale cannot name a board, which belongs to one, and is returned as it is.
   * Every caller of `checkAccess` passes one.
   */
  ruleRefFor(ref: RulePageRef): RulePageRef {
    if (!ref.locale) {
      return ref
    }
    const boards = this.#boards.get(`${ref.siteId}:${ref.locale}`)
    if (!boards) {
      return ref
    }
    const path = ref.path.replace(/^\/+|\/+$/g, '')
    const board = boards.find((entry) => path === entry.path || path.startsWith(`${entry.path}/`))
    if (!board) {
      return ref
    }
    return { siteId: ref.siteId, locale: board.locale, path: board.path, tags: board.tags }
  }

  /** Every board on a site, for the group editor's warning about rules written underneath one. */
  boardPaths(siteId: string): { locale: string; path: string; title: string }[] {
    const paths: { locale: string; path: string; title: string }[] = []
    for (const [key, boards] of this.#boards) {
      if (key.startsWith(`${siteId}:`)) {
        paths.push(
          ...boards.map((board) => ({ locale: board.locale, path: board.path, title: board.title }))
        )
      }
    }
    return paths.sort((a, b) => a.path.localeCompare(b.path) || a.locale.localeCompare(b.locale))
  }

  // == WHAT A BOARD HOLDS =============

  /*
    A board's folder holds its ideas and nothing else: no sub-folder, no attachment, no redirection,
    no blog or board of its own, and no page further down. The listing, the access rule and the
    submission form all assume a flat folder of ideas, and anything else put there would sit under
    the board's access without ever being listed by it.

    Asked by every model method that puts something somewhere — a page created, moved or restored, a
    folder created, renamed, moved or copied, a file uploaded, moved or imported — against the
    in-memory board list, so it costs the hot paths no query. Only a board itself arriving somewhere
    has to look at what is already there (`guardBoardFolder`).
  */

  /**
   * Refuse to put a folder, a file or a page in a board's folder, or anywhere under it, unless it is
   * an idea: a page directly in the folder with a body of its own.
   *
   * @param parentPath Slash-separated path of the folder it goes INTO, not of the thing itself
   * @param editor The page's editor, for a page
   * @throws `feedbackIdeasOnly`
   */
  refuseNonIdea(
    siteId: string,
    locale: string,
    {
      kind,
      parentPath,
      editor
    }: { kind: 'folder' | 'asset' | 'page'; parentPath: string | null | undefined; editor?: string }
  ): void {
    const parent = (parentPath ?? '').replace(/^\/+|\/+$/g, '')
    if (!parent) {
      return
    }
    // -> Outermost first, so a board left inside another by older data is still the outer one's
    //    sub-folder and holds nothing new either
    const board = this.#boards
      .get(`${siteId}:${locale}`)
      ?.find((entry) => parent === entry.path || parent.startsWith(`${entry.path}/`))
    if (!board) {
      return
    }
    if (kind === 'page' && parent === board.path && !isBodylessEditor(editor || 'markdown')) {
      return
    }
    throw new CustomError(
      'feedbackIdeasOnly',
      kind === 'folder'
        ? `The feedback board "${board.title}" holds ideas and nothing else, so a folder cannot be placed in it.`
        : kind === 'asset'
          ? `The feedback board "${board.title}" holds ideas and nothing else, so a file cannot be placed in it.`
          : `The feedback board "${board.title}" holds ideas and nothing else: a page directly in its folder, with a body of its own.`
    )
  }

  /**
   * Refuse to bring a folder in as a board's own folder, which would put everything it holds in the
   * board at once. Creating that folder empty is how a board gets one (`blogs.ensureFolder`), so
   * this is asked only of a folder that arrives with contents — renamed, moved or copied. Where it is
   * going INTO is `refuseNonIdea`'s question.
   *
   * @param path Slash-separated path the folder itself would have
   * @throws `feedbackIdeasOnly`
   */
  refuseAsBoardFolder(siteId: string, locale: string, path: string): void {
    const board = this.boardAt(siteId, locale, path.replace(/^\/+|\/+$/g, ''))
    if (board) {
      throw new CustomError(
        'feedbackIdeasOnly',
        `This is where the feedback board "${board.title}" keeps its ideas, so an existing folder cannot be placed there.`
      )
    }
  }

  /**
   * Refuse to put a board where its folder already holds something that is not an idea — a
   * sub-folder, a file, or a page with no body of its own. The board would take every one of them
   * under its access, and could not list any of them.
   *
   * @param path Slash-separated path of the board's front page, which is also its folder
   * @throws `feedbackIdeasOnly`
   */
  async guardBoardFolder(siteId: string, locale: string, path: string): Promise<void> {
    const own = path.replace(/^\/+|\/+$/g, '')
    if (!own) {
      return
    }
    const occupants = await WIKI.db
      .select({ id: treeTable.id })
      .from(treeTable)
      .leftJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          eq(treeTable.folderPath, encodeTreePath(own)),
          or(ne(treeTable.type, 'page'), inArray(pagesTable.editor, bodylessEditors()))
        )
      )
      .limit(1)
    if (occupants.length > 0) {
      throw new CustomError(
        'feedbackIdeasOnly',
        `A feedback board holds ideas and nothing else, and the folder at /${own} already holds other folders, files or pages.`
      )
    }
  }

  /**
   * Whether somebody may edit or withdraw an idea through the submission form: they created it, it is
   * still open, and they hold `write:feedback` (asked at the board, like everything in it). Once a
   * maintainer has moved an idea on, its wording is what they answered, and it is no longer only its
   * author's to rewrite.
   *
   * @param may Asks for a page permission on the idea, as the caller has the request to ask with
   */
  mayEditOwn(
    userId: string | null,
    page: { creatorId: string },
    status: FeedbackStatus,
    may: (permission: string) => boolean
  ): boolean {
    return (
      Boolean(userId) && page.creatorId === userId && status === 'open' && may('write:feedback')
    )
  }

  /**
   * Whether somebody moderates a board: `review:pages` or `manage:pages`, the pair that moves an idea's
   * status. Neither implies the other, so both are asked.
   *
   * @param may Asks for a page permission on the board or one of its ideas
   */
  mayModerate(may: (permission: string) => boolean): boolean {
    return may('review:pages') || may('manage:pages')
  }

  /**
   * Whether somebody may edit an idea through the submission form: its author under `mayEditOwn`, or
   * a moderator of the board at any status. A moderator is who files ideas into categories on a board
   * whose submitters do not pick them, and the form is where that is done -- the properties dialog
   * offers raw tags, with nothing to say which of them are the board's categories.
   */
  mayEdit(
    userId: string | null,
    page: { creatorId: string },
    status: FeedbackStatus,
    may: (permission: string) => boolean
  ): boolean {
    return this.mayEditOwn(userId, page, status, may) || this.mayModerate(may)
  }

  // == SUBMISSIONS ====================

  /**
   * How long an account on this site waits between two submitted ideas, in seconds; 0 for no limit.
   *
   * The site's own setting (`editors.feedback.config.submissionInterval`, a duration such as `1m`)
   * rather than the comment cooldown: a form that creates a page -- history, a search entry, a copy
   * on every storage target, a notification to everybody following new pages -- is a dearer thing
   * to flood than a comment box, and is set on its own. `0` turns it off; a value that will not
   * parse is read as the default rather than as no limit, so a typo cannot open the board to a
   * flood.
   */
  submissionIntervalFor(siteId: string): number {
    const raw =
      `${WIKI.sites[siteId]?.config?.editors?.feedback?.config?.submissionInterval ?? ''}`.trim()
    if (raw === '0') {
      return 0
    }
    return durationToSeconds(raw, DEFAULT_SUBMISSION_INTERVAL)
  }

  /**
   * Hold a submitter to one idea per `submissionIntervalFor`: an open form that creates pages, held
   * back on the server so that the API, a personal access token and a scripted browser meet the same
   * limit the dialog does.
   *
   * Per account, on the postgres-backed counter the login and comment limits use, so the instances
   * of an HA set agree about it. Not per address: an office behind one address is many people with
   * an idea each, and an account is what submitting needs anyway.
   *
   * @returns How many seconds remain before the next submission, or 0 to go ahead
   */
  async consumeCooldown(siteId: string, userId: string): Promise<number> {
    const seconds = this.submissionIntervalFor(siteId)
    if (seconds < 1) {
      return 0
    }
    const verdict = await WIKI.models.rateLimits.consume(`feedback:${siteId}:${userId}`, {
      max: 1,
      windowSeconds: seconds,
      banSeconds: seconds
    })
    return verdict.allowed ? 0 : verdict.retryAfter
  }

  /**
   * Where in a board's folder an idea named `name` can go: the name itself, or the first of `name-2`,
   * `name-3`… nothing is using yet. Two ideas with the same title are two ideas, and the second
   * should not be refused for a collision its author cannot see.
   */
  async freePath(board: BoardRef, name: string): Promise<string> {
    const base = `${board.path}/${name}`
    const taken = new Set(
      (
        await WIKI.db
          .select({ path: pagesTable.path })
          .from(pagesTable)
          .where(
            and(
              eq(pagesTable.siteId, board.siteId),
              eq(pagesTable.locale, board.locale),
              sql`(${pagesTable.path} = ${base} OR ${pagesTable.path} LIKE ${`${base.replace(/[\\%_]/g, '\\$&')}-%`})`
            )
          )
      ).map((row) => row.path)
    )
    if (!taken.has(base)) {
      return base
    }
    let suffix = 2
    while (taken.has(`${base}-${suffix}`)) {
      suffix++
    }
    return `${base}-${suffix}`
  }

  // == STATUS =========================

  /**
   * Who submitted an idea, for its head: the page's creator, as a name and whether they have an
   * avatar to draw. One primary-key read. Null where there is nobody to show -- no creator, an
   * account since deleted, or a system account, which has no profile to point at either
   * (`users.getPublicProfile` makes the same cut).
   */
  async submitterOf(
    creatorId: string | null | undefined
  ): Promise<{ id: string; name: string; hasAvatar: boolean } | null> {
    if (!creatorId) {
      return null
    }
    const [row] = await WIKI.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        hasAvatar: usersTable.hasAvatar,
        isSystem: usersTable.isSystem
      })
      .from(usersTable)
      .where(eq(usersTable.id, creatorId))
    if (!row || row.isSystem) {
      return null
    }
    return { id: row.id, name: row.name, hasAvatar: row.hasAvatar }
  }

  /** Where an idea stands. One primary-key read, and `open` with nothing else for no row. */
  async statusOf(pageId: string): Promise<IdeaStatus> {
    const [row] = await WIKI.db
      .select({
        status: statusesTable.status,
        updatedAt: statusesTable.updatedAt,
        updatedById: statusesTable.updatedById,
        updatedByName: usersTable.name,
        commentId: statusesTable.commentId
      })
      .from(statusesTable)
      .leftJoin(usersTable, eq(usersTable.id, statusesTable.updatedById))
      .where(eq(statusesTable.pageId, pageId))
    if (!row) {
      return {
        status: 'open',
        updatedAt: null,
        updatedById: null,
        updatedByName: null,
        commentId: null
      }
    }
    return {
      status: isFeedbackStatus(row.status) ? row.status : 'open',
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
      updatedByName: row.updatedByName ?? null,
      commentId: row.commentId
    }
  }

  /**
   * Move an idea to another status, optionally saying why.
   *
   * The comment, when there is one, is posted in the same transaction as the status is written, so
   * that the discussion never shows an explanation for a change that did not happen, nor a change
   * that lost the words that came with it. It is a real comment — `meta.feedbackStatus` is all that
   * marks it — by whoever made the change.
   *
   * The page row is locked first, so that two people moving the same idea at once are told about
   * each other (409) rather than both succeeding against the same `from`.
   *
   * @throws CustomError 409 when the idea already has that status: there is nothing to change, and a
   *   comment with no change is just a comment.
   */
  async setStatus({
    pageId,
    status,
    comment,
    actor
  }: {
    pageId: string
    status: FeedbackStatus
    comment?: string | null
    actor: { id: string; name: string; ip: string }
  }): Promise<{ from: FeedbackStatus; status: IdeaStatus; comment: CommentEntry | null }> {
    const { from, posted } = await WIKI.db.transaction(async (tx: Transaction) => {
      await tx
        .select({ id: pagesTable.id })
        .from(pagesTable)
        .where(eq(pagesTable.id, pageId))
        .for('update')
      const [current] = await tx
        .select({ status: statusesTable.status })
        .from(statusesTable)
        .where(eq(statusesTable.pageId, pageId))
      const from: FeedbackStatus = isFeedbackStatus(current?.status) ? current.status : 'open'
      if (from === status) {
        throw new CustomError(
          'feedbackStatusUnchanged',
          'This idea already has that status. To say something without changing it, post a comment.',
          409
        )
      }
      const posted = comment
        ? await WIKI.models.comments.create(
            {
              pageId,
              content: comment,
              authorId: actor.id,
              authorName: actor.name,
              authorEmail: '',
              authorIP: actor.ip,
              meta: { feedbackStatus: { from, to: status } }
            },
            tx
          )
        : null
      const values = {
        status,
        commentId: posted?.id ?? null,
        updatedAt: new Date(),
        updatedById: actor.id
      }
      await tx
        .insert(statusesTable)
        .values({ pageId, ...values })
        .onConflictDoUpdate({ target: statusesTable.pageId, set: values })
      return { from, posted }
    })
    return { from, status: await this.statusOf(pageId), comment: posted }
  }

  // == LISTING ========================

  /**
   * The ideas of a board, as conditions on `tree` joined to `pages` and `feedbackStatuses`.
   *
   * Pages directly in the board's folder, with a body of their own, live unless this reader may see
   * the others, and matching `q` when there is one. A password-protected idea matches on its title
   * and description only, as in site search: the text behind the password is not something a search
   * may confirm the presence of.
   */
  async #ideaConditions(board: BoardRef, reader: Reader, q?: string | null): Promise<SQL[]> {
    const conditions: SQL[] = [
      eq(treeTable.siteId, board.siteId),
      eq(treeTable.locale, board.locale),
      eq(treeTable.type, 'page'),
      sql`${treeTable.folderPath} = ${encodeTreePath(board.path)}::ltree`,
      notInArray(pagesTable.editor, bodylessEditors())
    ]
    if (!reader.seeUnpublished) {
      conditions.push(liveCondition(pagesTable))
    }
    const terms = q?.trim()
    if (terms) {
      const tsQuery = await WIKI.models.search.tsQueryFor(board.locale, terms)
      conditions.push(
        sql`(${pagesTable.ts} @@ ${tsQuery} AND (${pagesTable.password} IS NULL OR ts_filter(${pagesTable.ts}, '{a,b}') @@ ${tsQuery}))`
      )
    }
    return conditions
  }

  /** An idea's status, `open` for no row. */
  #statusExpr(): SQL<string> {
    return sql<string>`coalesce(${statusesTable.status}, 'open')`
  }

  /** An idea's upvotes, off the totals cached on its page row. No join, no count. */
  #upvotesExpr(): SQL<number> {
    return sql<number>`coalesce((${pagesTable.ratings} -> 'thumbs' ->> 'up')::int, 0)`.mapWith(
      Number
    )
  }

  /**
   * When anything last happened to an idea: an edit, a status change or a comment. `greatest` skips
   * the nulls an idea with no status row or no comments has.
   */
  #lastActivityExpr(): SQL<Date> {
    return sql<Date>`greatest(${pagesTable.updatedAt}, ${statusesTable.updatedAt}, (
      SELECT max(c."createdAt") FROM comments c WHERE c."pageId" = ${pagesTable.id} AND c."deletedAt" IS NULL
    ))`.mapWith(pagesTable.updatedAt)
  }

  /**
   * One page of a board's listing, with its facets.
   *
   * Three queries over the same set of ideas: the facets (every idea matching `q`, before the status
   * and category filters, so that picking a filter never removes the control that undoes it), how
   * many match the filters, and the page of them asked for. Then two small ones over the ids on that
   * page: which the reader voted for, and how many comments each has.
   */
  async listing({
    board,
    viewerId,
    seeUnpublished,
    filter = {}
  }: Reader & { board: BoardRef; filter?: FeedbackFilter }): Promise<FeedbackListing> {
    const reader = { viewerId, seeUnpublished }
    const sort = filter.sort ?? board.settings.sort
    const statuses =
      filter.statuses && filter.statuses.length > 0 ? filter.statuses : defaultStatusesFor(sort)
    const categoryTags = board.settings.categories.map((category) => category.tag)
    const base = await this.#ideaConditions(board, reader, filter.q)
    const statusExpr = this.#statusExpr()

    const facets = await this.#facets(board, base, categoryTags)

    const filtered = [...base, inArray(statusExpr, statuses)]
    if (filter.category === 'none') {
      filtered.push(sql`NOT (${pagesTable.tags} && ${sql.param(categoryTags)}::text[])`)
    } else if (filter.category) {
      filtered.push(sql`${pagesTable.tags} @> ARRAY[${filter.category}]::text[]`)
    }

    const [totalRow] = await WIKI.db
      .select({ total: count() })
      .from(treeTable)
      .innerJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .leftJoin(statusesTable, eq(statusesTable.pageId, pagesTable.id))
      .where(and(...filtered))
    const total = Number(totalRow?.total ?? 0)
    const perPage = board.settings.perPage
    const pageCount = Math.max(1, Math.ceil(total / perPage))
    // -> Clamped rather than answered empty, as a blog's listing is
    const page = Math.min(Math.max(1, Math.trunc(filter.page ?? 1)), pageCount)

    const upvotes = this.#upvotesExpr()
    const lastActivity = this.#lastActivityExpr()
    const since = new Date(
      Temporal.Now.instant().subtract({ hours: TRENDING_WINDOW_DAYS * 24 }).epochMilliseconds
    )
    const recentVotes = WIKI.db
      .select({
        pageId: ratingsTable.pageId,
        votes: sql<number>`count(*)::int`.as('votes')
      })
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.kind, 'thumbs'),
          eq(ratingsTable.value, 1),
          gte(ratingsTable.updatedAt, since)
        )
      )
      .groupBy(ratingsTable.pageId)
      .as('recentVotes')
    const ordering = {
      top: [desc(upvotes), desc(pagesTable.createdAt)],
      newest: [desc(pagesTable.createdAt)],
      recent: [desc(lastActivity), desc(pagesTable.createdAt)],
      trending: [
        desc(sql`coalesce(${recentVotes.votes}, 0)`),
        desc(upvotes),
        desc(pagesTable.createdAt)
      ]
    }[sort]

    let query = this.#ideaSelect(lastActivity)
      .from(treeTable)
      .innerJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .leftJoin(statusesTable, eq(statusesTable.pageId, pagesTable.id))
      .leftJoin(usersTable, eq(usersTable.id, pagesTable.creatorId))
      .$dynamic()
    if (sort === 'trending') {
      query = query.leftJoin(recentVotes, eq(recentVotes.pageId, pagesTable.id))
    }
    const rows = await query
      .where(and(...filtered))
      .orderBy(...ordering, pagesTable.id)
      .limit(perPage)
      .offset((page - 1) * perPage)

    return {
      ideas: await this.#describe(board, rows, viewerId),
      total,
      page,
      pageCount,
      sort,
      statuses,
      facets
    }
  }

  /**
   * Ideas on a board that look like the one somebody is about to submit, for the duplicate check.
   *
   * Every status, because "this was already done" and "this was already declined" are both worth
   * knowing before submitting. Matched on the title and description only — the words somebody types
   * as a title are what they would have called an existing idea, not what its body goes on to say —
   * with the words ORed, and ranked by how well they match before how popular they are.
   */
  async similar({
    board,
    viewerId,
    seeUnpublished,
    title
  }: Reader & { board: BoardRef; title: string }): Promise<FeedbackIdea[]> {
    const terms = title.trim()
    if (!terms) {
      return []
    }
    const conditions = await this.#ideaConditions(board, { viewerId, seeUnpublished })
    const tsQuery = await WIKI.models.search.tsQueryFor(board.locale, terms, 'any')
    const heading = sql`ts_filter(${pagesTable.ts}, '{a,b}')`
    conditions.push(sql`${heading} @@ ${tsQuery}`)
    const rows = await this.#ideaSelect(this.#lastActivityExpr())
      .from(treeTable)
      .innerJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .leftJoin(statusesTable, eq(statusesTable.pageId, pagesTable.id))
      .leftJoin(usersTable, eq(usersTable.id, pagesTable.creatorId))
      .where(and(...conditions))
      .orderBy(desc(sql`ts_rank(${heading}, ${tsQuery})`), desc(this.#upvotesExpr()))
      .limit(SIMILAR_LIMIT)
    return this.#describe(board, rows, viewerId)
  }

  /** The columns an idea is read with, by the listing and the duplicate check alike. */
  #ideaSelect(lastActivity: SQL<Date>) {
    return WIKI.db.select({
      id: pagesTable.id,
      path: pagesTable.path,
      title: pagesTable.title,
      description: pagesTable.description,
      tags: pagesTable.tags,
      status: this.#statusExpr(),
      upvotes: this.#upvotesExpr(),
      authorId: pagesTable.creatorId,
      authorName: usersTable.name,
      createdAt: pagesTable.createdAt,
      lastActivityAt: lastActivity
    })
  }

  /**
   * The status and category counts, in one query: a filtered count per status and per category
   * rather than a `GROUP BY` over `unnest(tags)`, since both lists are short and known up front.
   */
  async #facets(board: BoardRef, base: SQL[], categoryTags: string[]): Promise<FeedbackFacets> {
    const statusExpr = this.#statusExpr()
    const columns: Record<string, SQL<number>> = {
      uncategorized:
        sql<number>`count(*) filter (where NOT (${pagesTable.tags} && ${sql.param(categoryTags)}::text[]))`.mapWith(
          Number
        )
    }
    FEEDBACK_STATUSES.forEach((status, index) => {
      columns[`s${index}`] = sql<number>`count(*) filter (where ${statusExpr} = ${status})`.mapWith(
        Number
      )
    })
    categoryTags.forEach((tag, index) => {
      columns[`c${index}`] =
        sql<number>`count(*) filter (where ${pagesTable.tags} @> ARRAY[${tag}]::text[])`.mapWith(
          Number
        )
    })
    const [row] = await WIKI.db
      .select(columns)
      .from(treeTable)
      .innerJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .leftJoin(statusesTable, eq(statusesTable.pageId, pagesTable.id))
      .where(and(...base))
    return {
      statuses: FEEDBACK_STATUSES.map((status, index) => ({
        status,
        count: row?.[`s${index}`] ?? 0
      })),
      categories: board.settings.categories.map((category, index) => ({
        tag: category.tag,
        label: category.label,
        count: row?.[`c${index}`] ?? 0
      })),
      uncategorized: row?.uncategorized ?? 0
    }
  }

  /** Rows as the API answers with them, with whether this reader voted and how much was said. */
  async #describe(
    board: BoardRef,
    rows: {
      id: string
      path: string
      title: string
      description: string | null
      tags: string[] | null
      status: string
      upvotes: number
      authorId: string
      authorName: string | null
      createdAt: Date
      lastActivityAt: Date
    }[],
    viewerId: string | null
  ): Promise<FeedbackIdea[]> {
    const ids = rows.map((row) => row.id)
    const [voted, comments] = await Promise.all([
      this.#votedBy(viewerId, ids),
      WIKI.models.comments.usesBuiltIn(board.siteId)
        ? WIKI.models.comments.countForPages(ids)
        : new Map<string, number>()
    ])
    const categoryTags = board.settings.categories.map((category) => category.tag)
    return rows.map((row) => {
      const tags = row.tags ?? []
      return {
        id: row.id,
        path: row.path,
        title: row.title,
        description: row.description ?? '',
        status: isFeedbackStatus(row.status) ? row.status : 'open',
        categories: categoryTags.filter((tag) => tags.includes(tag)),
        tags,
        upvotes: row.upvotes,
        viewerVoted: voted.has(row.id),
        commentsCount: comments.get(row.id) ?? 0,
        authorId: row.authorId,
        authorName: row.authorName ?? '',
        createdAt: row.createdAt,
        lastActivityAt: row.lastActivityAt
      }
    })
  }

  /** Which of these ideas this reader holds an upvote on. None for a guest, who cannot vote. */
  async #votedBy(viewerId: string | null, pageIds: string[]): Promise<Set<string>> {
    if (!viewerId || pageIds.length < 1) {
      return new Set()
    }
    const rows = await WIKI.db
      .select({ pageId: ratingsTable.pageId })
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.userId, viewerId),
          eq(ratingsTable.kind, 'thumbs'),
          eq(ratingsTable.value, 1),
          inArray(ratingsTable.pageId, pageIds)
        )
      )
    return new Set(rows.map((row) => row.pageId))
  }
}

export const feedback = new Feedback()
