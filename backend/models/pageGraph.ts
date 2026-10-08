import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import {
  pageLinks as pageLinksTable,
  pages as pagesTable,
  tree as treeTable
} from '../db/schema.ts'
import { decodeTreePath } from '../helpers/common.ts'
import { liveCondition } from '../helpers/publishing.ts'

/**
 * Page graph model
 *
 * Every page of one locale, the folders they sit in, and what links them together — the data behind
 * the file manager's graph view. One read of three tables, assembled here rather than in the client,
 * because the client may not be told about a page it cannot read, and which pages those are is only
 * known after the rows are in hand (see `visibility` below).
 *
 * Nothing new is stored. The hierarchy is the tree the file manager already browses, and the links
 * are `pageLinks`, which is kept in step with every save: what a page's render links to, where a
 * redirection points, and the page's relations.
 */

/** The editor whose content IS a link. See the same constant in `models/pageLinks.ts`. */
const REDIRECT_EDITOR = 'redirect'

/**
 * How many pages one graph may carry, links' far ends in other locales included.
 *
 * A ceiling rather than a page size: the view collapses what it draws to what fits on a screen, so it
 * needs the whole tree to decide what that is, and a second page of a graph means nothing. Far past
 * any wiki anybody runs as one locale of one site — `truncated` says so if one ever gets there.
 */
export const MAX_GRAPH_PAGES = 50_000

/** The same for links, which on a heavily cross-linked wiki outnumber the pages several times over. */
export const MAX_GRAPH_LINKS = 250_000

/** What a link is, as far as the graph draws it. */
export type GraphLinkKind = 'link' | 'relation' | 'redirect'

/**
 * How visible a page is to whoever is asking: `published` and `draft` are both drawn, the second
 * dimmed, and null is not drawn at all.
 */
export type GraphVisibility = 'published' | 'draft' | null

/** The columns the caller's visibility decision is made on. */
export interface GraphPageRef {
  locale: string
  path: string
  tags: string[]
  /** Whether the page is open to its readers now — see `helpers/publishing.ts`. */
  isLive: boolean
}

export interface GraphPage {
  id: string
  locale: string
  path: string
  title: string
  isPublished: boolean
  isRedirect: boolean
}

export interface GraphFolder {
  path: string
  title: string
  hue?: number
}

export interface GraphLink {
  /** Index into `pages` of the page the link is written on. */
  source: number
  /** Index into `pages` of the page it resolves to. */
  target: number
  kind: GraphLinkKind
  /** How many distinct hrefs on the source resolve to the target. */
  weight: number
}

export interface PageGraph {
  locale: string
  pages: GraphPage[]
  folders: GraphFolder[]
  links: GraphLink[]
  truncated: boolean
}

interface PageRow {
  id: string
  locale: string
  path: string
  title: string
  tags: string[] | null
  isLive: boolean
  editor: string
  alias: string | null
  relations: unknown
}

/** A function, not a constant: whether a page is live is a question about the time of the query. */
function pageColumns() {
  return {
    id: pagesTable.id,
    locale: pagesTable.locale,
    path: pagesTable.path,
    title: pagesTable.title,
    tags: pagesTable.tags,
    isLive: sql<boolean>`${liveCondition(pagesTable)}`.mapWith(Boolean),
    editor: pagesTable.editor,
    alias: pagesTable.alias
  }
}

/** Precedence when one page reaches another in more than one way: the strongest link is kept. */
const KIND_RANK: Record<GraphLinkKind, number> = { link: 0, relation: 1, redirect: 2 }

class PageGraphModel {
  /**
   * The graph of one locale of a site, as one requester may see it.
   *
   * @param visibility Decides, per page, whether it is drawn and how. Asked of the locale's own pages
   *                   and of every page in another locale that one of them links to. A page it
   *                   refuses is left out entirely, and so is every link touching it: a link to
   *                   something the reader may not know about would say that it is there.
   */
  async graphFor({
    siteId,
    locale,
    visibility
  }: {
    siteId: string
    locale: string
    visibility: (page: GraphPageRef) => GraphVisibility
  }): Promise<PageGraph> {
    let truncated = false

    // -> The locale's own pages. Relations are read here and nowhere else: they are what tells a
    //    relation apart from a link in the rows below, and only a source page's matter
    const pageRows = (await WIKI.db
      .select({ ...pageColumns(), relations: pagesTable.relations })
      .from(pagesTable)
      .where(and(eq(pagesTable.siteId, siteId), eq(pagesTable.locale, locale)))
      .orderBy(pagesTable.path)
      .limit(MAX_GRAPH_PAGES + 1)) as PageRow[]
    if (pageRows.length > MAX_GRAPH_PAGES) {
      pageRows.length = MAX_GRAPH_PAGES
      truncated = true
    }

    const pages: GraphPage[] = []
    const indexById = new Map<string, number>()
    // -> Asked once per page: a hub every other page links to would otherwise be judged per link
    const refused = new Set<string>()
    const add = (row: PageRow): number | null => {
      const known = indexById.get(row.id)
      if (known !== undefined) {
        return known
      }
      if (refused.has(row.id)) {
        return null
      }
      if (pages.length >= MAX_GRAPH_PAGES) {
        truncated = true
        return null
      }
      const seen = visibility({
        locale: row.locale,
        path: row.path,
        tags: row.tags ?? [],
        isLive: row.isLive
      })
      if (!seen) {
        refused.add(row.id)
        return null
      }
      indexById.set(row.id, pages.length)
      pages.push({
        id: row.id,
        locale: row.locale,
        path: row.path,
        title: row.title,
        isPublished: seen === 'published',
        isRedirect: row.editor === REDIRECT_EDITOR
      })
      return pages.length - 1
    }

    // -> Every row goes into the lookups, visible or not: a link resolving to a page the reader may
    //    not see has to be recognised as exactly that and dropped, not sent off to be looked for in
    //    another locale
    const byPath = new Map<string, PageRow>()
    const byAlias = new Map<string, PageRow>()
    const byId = new Map<string, PageRow>()
    const relationsOf = new Map<string, Set<string>>()
    for (const row of pageRows) {
      byPath.set(`${row.locale}/${row.path}`, row)
      byId.set(row.id, row)
      if (row.alias) {
        byAlias.set(row.alias, row)
      }
      const targets = (Array.isArray(row.relations) ? row.relations : [])
        .map((relation: any) => relation?.target)
        .filter((target: unknown): target is string => typeof target === 'string')
      if (targets.length > 0) {
        relationsOf.set(row.id, new Set(targets))
      }
      add(row)
    }

    // -> Every link written on one of those pages that addresses a page of this site. Assets are not
    //    pages, and a link to another site is not something this graph can place
    const linkRows = await WIKI.db
      .select({
        pageId: pageLinksTable.pageId,
        kind: pageLinksTable.kind,
        href: pageLinksTable.href,
        targetLocale: pageLinksTable.targetLocale,
        targetPath: pageLinksTable.targetPath,
        targetRef: pageLinksTable.targetRef
      })
      .from(pageLinksTable)
      .innerJoin(pagesTable, eq(pagesTable.id, pageLinksTable.pageId))
      .where(
        and(
          eq(pagesTable.siteId, siteId),
          eq(pagesTable.locale, locale),
          eq(pageLinksTable.targetSiteId, siteId),
          inArray(pageLinksTable.kind, ['page', 'alias', 'pageId'])
        )
      )
      .limit(MAX_GRAPH_LINKS + 1)
    if (linkRows.length > MAX_GRAPH_LINKS) {
      linkRows.length = MAX_GRAPH_LINKS
      truncated = true
    }

    const resolve = (link: (typeof linkRows)[number]): PageRow | undefined => {
      switch (link.kind) {
        case 'page':
          return byPath.get(`${link.targetLocale}/${link.targetPath}`)
        case 'alias':
          return link.targetRef ? byAlias.get(link.targetRef) : undefined
        case 'pageId':
          return link.targetRef ? byId.get(link.targetRef) : undefined
      }
      return undefined
    }

    // -> What the locale's own pages could not answer: a page in another locale, or an alias or an id
    //    naming one. Looked up in one query, and only for what was actually linked to
    const missing = {
      paths: new Map<string, { locale: string; path: string }>(),
      refs: new Set<string>()
    }
    for (const link of linkRows) {
      if (resolve(link)) {
        continue
      }
      if (
        link.kind === 'page' &&
        link.targetLocale &&
        link.targetPath &&
        link.targetLocale !== locale
      ) {
        missing.paths.set(`${link.targetLocale}/${link.targetPath}`, {
          locale: link.targetLocale,
          path: link.targetPath
        })
      } else if (link.kind !== 'page' && link.targetRef) {
        missing.refs.add(link.targetRef)
      }
    }
    if (missing.paths.size > 0 || missing.refs.size > 0) {
      const lookups: SQL[] = []
      if (missing.paths.size > 0) {
        const wanted = [...missing.paths.values()]
        lookups.push(
          sql`(${pagesTable.locale}, ${pagesTable.path}) IN (SELECT * FROM unnest(${sql.param(
            wanted.map((w) => w.locale)
          )}::text[], ${sql.param(wanted.map((w) => w.path))}::text[]))`
        )
      }
      if (missing.refs.size > 0) {
        const refs = [...missing.refs]
        // -> Compared as text: a `/i/<id>` link carries whatever was written after the slash, and a
        //    uuid cast would fail the whole read on the first one that is not an id at all
        lookups.push(sql`${pagesTable.id}::text = ANY(${sql.param(refs)}::text[])`)
        lookups.push(sql`${pagesTable.alias} = ANY(${sql.param(refs)}::text[])`)
      }
      const others = (await WIKI.db
        .select(pageColumns())
        .from(pagesTable)
        .where(
          and(eq(pagesTable.siteId, siteId), sql`(${sql.join(lookups, sql` OR `)})`)
        )) as PageRow[]
      for (const row of others) {
        byPath.set(`${row.locale}/${row.path}`, row)
        byId.set(row.id, row)
        if (row.alias && !byAlias.has(row.alias)) {
          byAlias.set(row.alias, row)
        }
      }
    }

    // -> One edge per pair of pages, however many ways the source reaches the target
    const edges = new Map<string, GraphLink>()
    for (const link of linkRows) {
      const source = indexById.get(link.pageId)
      const targetRow = resolve(link)
      if (source === undefined || !targetRow || targetRow.id === link.pageId) {
        continue
      }
      const target = add(targetRow)
      if (target === null) {
        continue
      }
      const sourceRow = byId.get(link.pageId)!
      const kind: GraphLinkKind =
        sourceRow.editor === REDIRECT_EDITOR
          ? 'redirect'
          : relationsOf.get(link.pageId)?.has(link.href)
            ? 'relation'
            : 'link'
      const key = `${source}:${target}`
      const edge = edges.get(key)
      if (edge) {
        edge.weight++
        if (KIND_RANK[kind] > KIND_RANK[edge.kind]) {
          edge.kind = kind
        }
      } else {
        edges.set(key, { source, target, kind, weight: 1 })
      }
    }

    return {
      locale,
      pages,
      folders: await this.foldersAbove(siteId, locale, pages),
      links: [...edges.values()],
      truncated
    }
  }

  /**
   * The folders the drawn pages of this locale sit in, and no others.
   *
   * Derived from the pages rather than listed, so a folder holding nothing this reader may see is not
   * in the graph at all — the file manager's own tree cannot afford that question, but here every page
   * has already been decided. A path with no folder row above a page (a page created at a deep path
   * before its folders existed) still gets drawn by the client, named after its segment.
   */
  private async foldersAbove(
    siteId: string,
    locale: string,
    pages: GraphPage[]
  ): Promise<GraphFolder[]> {
    const wanted = new Set<string>()
    for (const page of pages) {
      if (page.locale !== locale) {
        continue
      }
      const parts = page.path.split('/')
      for (let i = 1; i < parts.length; i++) {
        wanted.add(parts.slice(0, i).join('/'))
      }
    }
    if (wanted.size < 1) {
      return []
    }

    const rows = await WIKI.db
      .select({
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        title: treeTable.title,
        meta: treeTable.meta
      })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          eq(treeTable.type, 'folder')
        )
      )

    const folders: GraphFolder[] = []
    for (const row of rows) {
      const parent = decodeTreePath(row.folderPath)
      const path = parent ? `${parent}/${row.fileName}` : row.fileName
      if (!wanted.has(path)) {
        continue
      }
      const hue = (row.meta as { hue?: number } | null)?.hue
      folders.push({ path, title: row.title, ...(hue ? { hue } : {}) })
    }
    return folders.sort((a, b) => a.path.localeCompare(b.path))
  }
}

export const pageGraph = new PageGraphModel()
