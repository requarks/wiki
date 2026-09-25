import { and, asc, eq, gt, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  navigation as navigationTable,
  pages as pagesTable,
  tree as treeTable
} from '../db/schema.ts'
import { decodeTreePath, generatePathHash } from '../helpers/common.ts'
import { resolveLink } from '../helpers/pageLinks.ts'
import type { ResolvedLink } from '../helpers/pageLinks.ts'
import { PENDING_RENDER_HTML } from './import.ts'
import { isBodylessEditor, isKnownEditor, normalizeBodylessContent } from './pages.ts'

/** What a problem means for the page: `error` is broken for readers, `warning` is out of step. */
export type ProblemSeverity = 'error' | 'warning'

/**
 * Every check the scan runs, in the order the admin screen lists them.
 *
 * The key is also the translation key of the check's label (`admin.utilities.pageProblems.checks.*`)
 * and of the line a problem it finds is logged as (`admin.utilities.pageProblems.problems.*`), so a
 * check added here needs both strings.
 */
export const PAGE_PROBLEM_CHECKS = [
  { key: 'contentEmpty', group: 'content', severity: 'error' },
  { key: 'renderEmpty', group: 'content', severity: 'error' },
  { key: 'renderPending', group: 'content', severity: 'warning' },
  { key: 'contentInvalidJson', group: 'content', severity: 'error' },
  { key: 'contentInvalid', group: 'content', severity: 'error' },
  { key: 'editorUnknown', group: 'editor', severity: 'error' },
  { key: 'editorDisabled', group: 'editor', severity: 'warning' },
  { key: 'redirectTargetMissing', group: 'redirects', severity: 'error' },
  { key: 'redirectSelf', group: 'redirects', severity: 'error' },
  { key: 'redirectLoop', group: 'redirects', severity: 'error' },
  { key: 'redirectChainTooLong', group: 'redirects', severity: 'error' },
  { key: 'redirectChain', group: 'redirects', severity: 'warning' },
  { key: 'treeEntryMissing', group: 'tree', severity: 'error' },
  { key: 'treeEntryMismatch', group: 'tree', severity: 'error' },
  { key: 'treeEntryOrphaned', group: 'tree', severity: 'error' },
  { key: 'treeEntryStale', group: 'tree', severity: 'warning' },
  { key: 'hashMismatch', group: 'address', severity: 'error' },
  { key: 'aliasDuplicate', group: 'address', severity: 'error' },
  { key: 'localeInactive', group: 'locales', severity: 'warning' },
  { key: 'localeGroupOrphaned', group: 'locales', severity: 'warning' },
  { key: 'scheduledWithoutDates', group: 'publishing', severity: 'warning' },
  { key: 'publishDatesInverted', group: 'publishing', severity: 'warning' },
  { key: 'searchIndexMissing', group: 'search', severity: 'warning' },
  { key: 'navigationMenuMissing', group: 'navigation', severity: 'warning' }
] as const satisfies readonly { key: string; group: string; severity: ProblemSeverity }[]

export type PageProblemCheck = (typeof PAGE_PROBLEM_CHECKS)[number]['key']

const SEVERITY_OF = new Map<string, ProblemSeverity>(
  PAGE_PROBLEM_CHECKS.map((check) => [check.key, check.severity])
)

/** One thing found wrong with one page, or with a tree entry that has no page. */
export interface PageProblem {
  check: PageProblemCheck
  severity: ProblemSeverity
  /** Null for an orphaned tree entry, which is the one problem that has no page. */
  pageId: string | null
  siteId: string
  locale: string
  path: string
  title: string
  /** Where to open the page, or null where there is no page to open. */
  url: string | null
  /** Filled into the problem's line, by the names its string uses. */
  params: Record<string, string | number>
}

export interface PageProblemBatch {
  problems: PageProblem[]
  /** Rows looked at by this call, pages and tree entries alike. */
  scanned: number
  /** What to send back for the next batch, or null once there is nothing left. */
  cursor: string | null
}

/**
 * Pages read per call. Small enough that one call answers in well under a second on a large wiki,
 * which is what keeps the progress bar moving and a Stop button meaningful.
 */
const PAGE_BATCH_SIZE = 250

/** Tree entries per call in the second phase, which reads only ids and so can take more. */
const TREE_BATCH_SIZE = 1000

/**
 * How many redirections a reader's browser follows in a row before calling it a loop — `MAX_HOPS`
 * in `frontend/src/components/PageRedirect.vue`, which stops on the one after it. The two have to
 * agree, or this reports as fine a chain that readers are stopped at.
 */
const MAX_REDIRECT_HOPS = 5

/**
 * The two editors behind the experimental flag (`BODYLESS_EDITORS` in `frontend/src/stores/site.js`).
 * The server has no content type for them yet, so they are not "unknown", and nothing about what they
 * store is settled enough to check.
 */
const EXPERIMENTAL_EDITORS = new Set(['channel', 'api'])

const REDIRECT_EDITOR = 'redirect'

/** The two navigation modes under which a page draws a menu of its own rather than an ancestor's. */
const OVERRIDE_MODES = new Set(['override', 'overrideExact'])

/**
 * Where the scan is. `p:` is the pages phase and `t:` the orphaned tree entries after it, each with
 * the last id the previous call read; an id alone is enough to carry on because both walk in id
 * order.
 */
function parseCursor(cursor?: string): { phase: 'pages' | 'tree'; after: string | null } {
  if (cursor?.startsWith('t:')) {
    return { phase: 'tree', after: cursor.slice(2) || null }
  }
  if (cursor?.startsWith('p:')) {
    return { phase: 'pages', after: cursor.slice(2) || null }
  }
  return { phase: 'pages', after: null }
}

/** A page a redirection lands on, with what is needed to follow it further. */
interface RedirectHop {
  id: string
  siteId: string
  locale: string
  path: string
  editor: string
  content: string | null
}

/**
 * Page problems model
 *
 * A read-only scan of every page on every site for data that is broken or out of step: the things
 * nothing at save time can see, because they are the result of an import, a failed write halfway
 * through a multi-statement change, or a setting changed after the page was written.
 *
 * **It never changes anything.** Each check reports; fixing is a separate decision per check, and some
 * of them have more than one right answer.
 *
 * **Driven by the caller, a batch at a time**, the way the 2.x import is: the admin screen asks for
 * the next batch until the cursor comes back null, so progress is the screen's own count and stopping
 * is simply not asking again. There is no job and nothing to clean up after a scan abandoned halfway.
 * Pages are walked in id order, so one created mid-scan is either reached or not — never read twice.
 */
class PageProblems {
  /**
   * How big a full scan is: `pages` to say so, and `total` rows for the progress bar — every page,
   * then every page entry in the tree, since the second phase reads those too.
   */
  async size(): Promise<{ pages: number; total: number }> {
    const [pages] = await WIKI.db.select({ n: sql<number>`count(*)::int` }).from(pagesTable)
    const [entries] = await WIKI.db
      .select({ n: sql<number>`count(*)::int` })
      .from(treeTable)
      .where(eq(treeTable.type, 'page'))
    const pageCount = Number(pages?.n ?? 0)
    return { pages: pageCount, total: pageCount + Number(entries?.n ?? 0) }
  }

  /** The next batch of the scan, starting after `cursor` — or from the beginning without one. */
  async scan(cursor?: string): Promise<PageProblemBatch> {
    const { phase, after } = parseCursor(cursor)
    return phase === 'pages' ? this.#scanPages(after) : this.#scanTree(after)
  }

  /**
   * Every check that is a question about a page, for one batch of pages.
   *
   * One query answers all of them but the redirections: the tree entry comes in by join, and the
   * locale group, the alias and the menu are subqueries per row. The content and the render are
   * never read whole — only whether they are empty — except a bodyless page's content, which is the
   * small settings document the JSON checks parse.
   */
  async #scanPages(after: string | null): Promise<PageProblemBatch> {
    const groupMember = alias(pagesTable, 'groupMember')
    const aliasTwin = alias(pagesTable, 'aliasTwin')

    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        siteId: pagesTable.siteId,
        locale: pagesTable.locale,
        path: pagesTable.path,
        hash: pagesTable.hash,
        alias: pagesTable.alias,
        title: pagesTable.title,
        description: pagesTable.description,
        editor: pagesTable.editor,
        contentType: pagesTable.contentType,
        publishState: pagesTable.publishState,
        publishStartDate: pagesTable.publishStartDate,
        publishEndDate: pagesTable.publishEndDate,
        isBrowsable: pagesTable.isBrowsable,
        isSearchable: pagesTable.isSearchableComputed,
        tags: pagesTable.tags,
        authorId: pagesTable.authorId,
        creatorId: pagesTable.creatorId,
        ownerId: pagesTable.ownerId,
        localeGroupId: pagesTable.localeGroupId,
        contentEmpty: sql<boolean>`coalesce(btrim(${pagesTable.content}), '') = ''`,
        renderEmpty: sql<boolean>`coalesce(btrim(${pagesTable.render}), '') = ''`,
        renderPending: sql<boolean>`coalesce(${pagesTable.render} = ${PENDING_RENDER_HTML}, false)`,
        searchTextMissing: sql<boolean>`${pagesTable.searchContent} is null`,
        searchVectorMissing: sql<boolean>`${pagesTable.ts} is null`,
        bodylessContent: sql<
          string | null
        >`case when ${pagesTable.editor} in ('redirect', 'blog') then ${pagesTable.content} end`,
        treeId: treeTable.id,
        treeType: treeTable.type,
        treeSiteId: treeTable.siteId,
        treeLocale: treeTable.locale,
        treeFolderPath: treeTable.folderPath,
        treeFileName: treeTable.fileName,
        treeTitle: treeTable.title,
        treeTags: treeTable.tags,
        treeMeta: treeTable.meta,
        navigationMode: treeTable.navigationMode,
        navigationId: treeTable.navigationId,
        navigationExists: sql<boolean>`exists (${WIKI.db
          .select({ one: sql`1` })
          .from(navigationTable)
          .where(eq(navigationTable.id, treeTable.navigationId))})`,
        groupSize: sql<number>`(${WIKI.db
          .select({ n: sql`count(*)::int` })
          .from(groupMember)
          .where(
            and(
              eq(groupMember.siteId, pagesTable.siteId),
              eq(groupMember.localeGroupId, pagesTable.localeGroupId)
            )
          )})`,
        aliasTaken: sql<boolean>`exists (${WIKI.db
          .select({ one: sql`1` })
          .from(aliasTwin)
          .where(
            and(
              eq(aliasTwin.siteId, pagesTable.siteId),
              eq(aliasTwin.alias, pagesTable.alias),
              sql`${aliasTwin.id} <> ${pagesTable.id}`
            )
          )})`
      })
      .from(pagesTable)
      .leftJoin(treeTable, eq(treeTable.id, pagesTable.id))
      .where(after ? gt(pagesTable.id, after) : undefined)
      .orderBy(asc(pagesTable.id))
      .limit(PAGE_BATCH_SIZE)

    const problems: PageProblem[] = []
    for (const row of rows) {
      const report = (check: PageProblemCheck, params: Record<string, string | number> = {}) => {
        problems.push({
          check,
          severity: SEVERITY_OF.get(check)!,
          pageId: row.id,
          siteId: row.siteId,
          locale: row.locale,
          path: row.path,
          title: row.title,
          url: this.#pageUrl(row.siteId, row.locale, row.path, row.editor),
          params
        })
      }
      const site = WIKI.sites[row.siteId]
      const isExperimental = EXPERIMENTAL_EDITORS.has(row.editor)
      const isKnown = isKnownEditor(row.editor)
      const isBodyless = isBodylessEditor(row.editor)

      // -> Content
      if (row.contentEmpty) {
        report('contentEmpty')
      }
      if (isKnown && !isBodyless && row.renderEmpty) {
        report('renderEmpty', { editor: row.editor })
      }
      if (row.renderPending) {
        report('renderPending')
      }
      if (isBodyless && !row.contentEmpty) {
        this.#checkBodylessContent(row.editor, row.bodylessContent, report)
      }

      // -> Editor
      if (!isKnown && !isExperimental) {
        report('editorUnknown', { editor: row.editor })
      } else if (isKnown && site?.config?.editors?.[row.editor]?.isActive === false) {
        report('editorDisabled', { editor: row.editor })
      }

      // -> Redirections
      if (row.editor === REDIRECT_EDITOR && !row.contentEmpty) {
        await this.#checkRedirect(row, report)
      }

      // -> Tree
      if (!row.treeId) {
        report('treeEntryMissing')
      } else {
        const folder = row.treeFolderPath ? decodeTreePath(row.treeFolderPath) : ''
        const treePath = folder ? `${folder}/${row.treeFileName}` : (row.treeFileName ?? '')
        if (
          row.treeType !== 'page' ||
          row.treeSiteId !== row.siteId ||
          row.treeLocale !== row.locale ||
          treePath.toLowerCase() !== row.path.toLowerCase()
        ) {
          report('treeEntryMismatch', { treePath: `${row.treeLocale}/${treePath}` })
        } else {
          const stale = this.#staleTreeFields(row)
          if (stale.length > 0) {
            report('treeEntryStale', { fields: stale.join(', ') })
          }
        }

        // -> Navigation, which lives on the tree entry
        const menuMissing = row.navigationId
          ? !row.navigationExists
          : OVERRIDE_MODES.has(row.navigationMode ?? '')
        if (menuMissing) {
          report('navigationMenuMissing', { mode: row.navigationMode ?? 'inherit' })
        }
      }

      // -> Address
      if (row.hash !== generatePathHash(row.path)) {
        report('hashMismatch')
      }
      if (row.alias && row.aliasTaken) {
        report('aliasDuplicate', { alias: row.alias })
      }

      // -> Locales
      const activeLocales: string[] = site?.config?.locales?.active ?? []
      if (!activeLocales.includes(row.locale)) {
        report('localeInactive', { locale: row.locale })
      }
      if (row.localeGroupId && Number(row.groupSize) < 2) {
        report('localeGroupOrphaned')
      }

      // -> Publishing
      if (row.publishState === 'scheduled' && !row.publishStartDate && !row.publishEndDate) {
        report('scheduledWithoutDates')
      }
      if (
        row.publishStartDate &&
        row.publishEndDate &&
        row.publishEndDate.getTime() <= row.publishStartDate.getTime()
      ) {
        report('publishDatesInverted')
      }

      // -> Search. A render with no extracted text is a body the index cannot see; a page with no
      //    vector at all is missing from results even by title
      if (
        row.isSearchable &&
        (row.searchVectorMissing || (!isBodyless && !row.renderEmpty && row.searchTextMissing))
      ) {
        report('searchIndexMissing')
      }
    }

    const last = rows.at(-1)
    return {
      problems,
      scanned: rows.length,
      // -> A short batch is the last one; the tree phase starts from its own beginning
      cursor: rows.length < PAGE_BATCH_SIZE ? 't:' : `p:${last!.id}`
    }
  }

  /**
   * Tree entries of type page with no page behind them.
   *
   * The one check that cannot be asked of a page, since there is none, so it is a phase of its own
   * after the pages. Such an entry is listed in the file browser and the sidebar and leads to a 404.
   */
  async #scanTree(after: string | null): Promise<PageProblemBatch> {
    const rows = await WIKI.db
      .select({
        id: treeTable.id,
        siteId: treeTable.siteId,
        locale: treeTable.locale,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        title: treeTable.title,
        pageId: pagesTable.id
      })
      .from(treeTable)
      .leftJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .where(and(eq(treeTable.type, 'page'), after ? gt(treeTable.id, after) : undefined))
      .orderBy(asc(treeTable.id))
      .limit(TREE_BATCH_SIZE)

    const problems: PageProblem[] = rows
      .filter((row) => !row.pageId)
      .map((row) => {
        const folder = row.folderPath ? decodeTreePath(row.folderPath) : ''
        return {
          check: 'treeEntryOrphaned',
          severity: SEVERITY_OF.get('treeEntryOrphaned')!,
          pageId: null,
          siteId: row.siteId,
          locale: row.locale,
          path: folder ? `${folder}/${row.fileName}` : row.fileName,
          title: row.title,
          url: null,
          params: {}
        }
      })

    const last = rows.at(-1)
    return {
      problems,
      scanned: rows.length,
      cursor: rows.length < TREE_BATCH_SIZE ? null : `t:${last!.id}`
    }
  }

  /**
   * A redirection's or a blog's settings document, read the way saving it would.
   *
   * Two checks, because they are two different breakages: a document that is not a JSON object at
   * all (what the editor opens is blank, and a blog quietly falls back to every default), and one that
   * parses but that the save path would refuse — a redirection with no target, a blog asking for
   * no posts per page. The second is the save path's own normalizer, so the two cannot disagree about
   * what is valid, and the reason given is the one a save would have been refused with.
   */
  #checkBodylessContent(
    editor: string,
    content: string | null,
    report: (check: PageProblemCheck, params?: Record<string, string | number>) => void
  ): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(content ?? '')
    } catch {
      parsed = undefined
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      report('contentInvalidJson', { editor })
      return
    }
    try {
      normalizeBodylessContent(editor, content ?? '')
    } catch (err: any) {
      report('contentInvalid', { reason: err.message })
    }
  }

  /**
   * Follow a redirection the way a reader's browser would, and report where that goes wrong.
   *
   * Resolved with `resolveLink`, which is what the link table uses and what puts the site's locale
   * prefix and page extensions into play, then looked up page by page — a chain is followed until it
   * reaches something that is not a redirection, comes back on itself, or runs past what a browser
   * will follow. Only this page's own problem is reported: a chain that breaks further along is
   * reported against the page where it breaks, when the scan gets to that one.
   *
   * A URL target, or a path to something that is not a page (`/_admin`, a file), is not followed.
   */
  async #checkRedirect(
    page: {
      id: string
      siteId: string
      locale: string
      path: string
      bodylessContent: string | null
    },
    report: (check: PageProblemCheck, params?: Record<string, string | number>) => void
  ): Promise<void> {
    const visited = new Set<string>([page.id])
    let current: { siteId: string; locale: string; path: string; content: string | null } = {
      ...page,
      content: page.bodylessContent
    }
    let redirections = 1
    let firstTarget = ''

    while (true) {
      const target = this.#redirectTargetOf(current.content)
      if (!target) {
        return
      }
      firstTarget ||= target
      const link = resolveLink(target, current)
      if (!link || (link.kind !== 'page' && link.kind !== 'alias' && link.kind !== 'pageId')) {
        return
      }
      const hop = await this.#findPage(link)
      if (!hop) {
        if (redirections === 1) {
          report('redirectTargetMissing', { target })
        }
        return
      }
      if (hop.id === page.id) {
        report(redirections === 1 ? 'redirectSelf' : 'redirectLoop', { target: firstTarget })
        return
      }
      if (visited.has(hop.id)) {
        // -> This page leads into a loop that it is not part of: the pages in the loop report
        //    themselves, and a reader arriving here goes round it just the same
        report('redirectLoop', { target: firstTarget })
        return
      }
      if (hop.editor !== REDIRECT_EDITOR) {
        if (redirections > 1) {
          report('redirectChain', { target: firstTarget, hops: redirections })
        }
        return
      }
      visited.add(hop.id)
      redirections++
      if (redirections > MAX_REDIRECT_HOPS) {
        report('redirectChainTooLong', { target: firstTarget, max: MAX_REDIRECT_HOPS })
        return
      }
      current = hop
    }
  }

  /** A redirection's target when it points at a page of this wiki, or null. */
  #redirectTargetOf(content: string | null): string | null {
    try {
      const parsed = JSON.parse(content ?? '')
      if (parsed?.kind === 'url' || typeof parsed?.target !== 'string') {
        return null
      }
      const target = parsed.target.trim()
      return target.length > 0 ? target : null
    } catch {
      return null
    }
  }

  /** The page a resolved link addresses, by the same three keys `pageLinks.outboundFor` joins on. */
  async #findPage(link: ResolvedLink): Promise<RedirectHop | null> {
    const where =
      link.kind === 'page'
        ? and(
            eq(pagesTable.siteId, link.targetSiteId),
            eq(pagesTable.locale, link.targetLocale ?? ''),
            eq(pagesTable.path, link.targetPath ?? '')
          )
        : link.kind === 'alias'
          ? and(
              eq(pagesTable.siteId, link.targetSiteId),
              eq(pagesTable.alias, link.targetRef ?? '')
            )
          : sql`${pagesTable.id}::text = ${link.targetRef ?? ''}`
    const [row] = await WIKI.db
      .select({
        id: pagesTable.id,
        siteId: pagesTable.siteId,
        locale: pagesTable.locale,
        path: pagesTable.path,
        editor: pagesTable.editor,
        content: sql<
          string | null
        >`case when ${pagesTable.editor} = 'redirect' then ${pagesTable.content} end`
      })
      .from(pagesTable)
      .where(where)
      .limit(1)
    return row ?? null
  }

  /**
   * Which of the copies a tree entry keeps of its page no longer match it.
   *
   * Compared through `pages.treeMeta`, the function that writes them, and through JSON, since the
   * stored copy has been through a `jsonb` column and a date in it is the ISO string of the one on the
   * page.
   */
  #staleTreeFields(row: any): string[] {
    const stale: string[] = []
    if (row.treeTitle !== row.title) {
      stale.push('title')
    }
    if (JSON.stringify(row.treeTags ?? []) !== JSON.stringify(row.tags ?? [])) {
      stale.push('tags')
    }
    const expected = JSON.parse(JSON.stringify(WIKI.models.pages.treeMeta(row)))
    const stored = (row.treeMeta ?? {}) as Record<string, unknown>
    for (const [key, value] of Object.entries(expected)) {
      if (JSON.stringify(stored[key] ?? null) !== JSON.stringify(value ?? null)) {
        stale.push(key)
      }
    }
    return stale
  }

  /**
   * Where to open a page from the admin area, which may be on another site's hostname.
   *
   * A redirection carries `?redirect=no`, since the whole reason to open one from here is to look at
   * it rather than be sent on.
   */
  #pageUrl(siteId: string, locale: string, path: string, editor: string): string {
    const hostname = WIKI.sites[siteId]?.hostname
    const origin = hostname && hostname !== '*' ? `//${hostname}` : ''
    const query = editor === REDIRECT_EDITOR ? '?redirect=no' : ''
    return `${origin}${WIKI.models.pages.urlFor(siteId, locale, path)}${query}`
  }
}

export const pageProblems = new PageProblems()
