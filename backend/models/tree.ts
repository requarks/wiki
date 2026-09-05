import { and, asc, desc, eq, exists, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import { alias, type PgColumn } from 'drizzle-orm/pg-core'
import { pages as pagesTable, tree as treeTable } from '../db/schema.ts'
import {
  CustomError,
  decodeTreePath,
  encodeTreePath,
  generateHash,
  generatePathHash,
  normalizeFolderPath,
  normalizePagePath
} from '../helpers/common.ts'
import type { PageActor } from './pages.ts'

/** What a tree entry can be. Mirrors the `treeType` enum in the schema. */
export type TreeItemType = 'folder' | 'page' | 'asset'

/** The fields a tree listing can be sorted on. */
export const TREE_ORDER_BY = ['createdAt', 'fileName', 'title', 'updatedAt'] as const

export type TreeOrderBy = (typeof TREE_ORDER_BY)[number]

/**
 * A tree entry as exposed by the API.
 *
 * One shape for all three kinds rather than three: a folder listing interleaves them, and the type
 * field is what tells them apart. The kind-specific fields are absent on the kinds they do not apply
 * to.
 */
export interface TreeItem {
  id: string
  type: TreeItemType
  /** How many folders deep the entry sits, 0 being the root. */
  depth: number
  /** Slash-separated, without a leading or trailing slash. Empty at the root. */
  folderPath: string
  fileName: string
  title: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  /** Folders only — how many entries the folder holds. */
  childrenCount?: number
  /**
   * Folders only — how far the folder icon is rotated around the colour wheel, in degrees.
   *
   * Absent on a folder nobody has coloured, which is the same thing as zero: the icon is drawn
   * yellow and a rotation of nothing leaves it there.
   */
  hue?: number
  /** Folders only — whether this folder is a parent of the one being listed, not a child of it. */
  isAncestor?: boolean
  /** Assets only. */
  fileSize?: number
  fileExt?: string
  mimeType?: string
  /** Image assets only — in pixels, as displayed. Absent when the dimensions were never read. */
  width?: number
  height?: number
  /** Pages only. */
  editor?: string
  description?: string
}

/**
 * One row of a browse listing.
 *
 * A page and a folder can sit at the very same path — `/foo/bar` the page, `/foo/bar/…` the folder of
 * pages under it — and a reader thinks of those as one thing with two ways in, so they come back as
 * one entry carrying both flags rather than as two rows with the same name.
 */
export interface BrowseItem {
  /** Slash-separated path of the entry: the page's own URL, and the folder to list on the way down. */
  path: string
  fileName: string
  title: string
  /** The page's icon, as an Iconify reference. Null for a folder with no page at its path. */
  icon: string | null
  isPage: boolean
  isFolder: boolean
}

/** One level of a browse listing: what a folder holds, plus what the folder itself is called. */
export interface BrowseLevel {
  /** The folder that was listed, slash-separated. Empty at the site root. */
  path: string
  /** The folder's title. Empty at the site root, which is not a folder and has no row of its own. */
  title: string
  items: BrowseItem[]
  /** Whether the folder holds more than `MAX_BROWSE` entries, the rest of which were dropped. */
  truncated: boolean
}

/** One page of a reader-facing listing, as the index block draws it. */
export interface ListedPage {
  id: string
  /** Slash-separated path of the page, i.e. its URL within the site. */
  path: string
  title: string
  description: string
  /** The page's icon, as an Iconify reference. Empty when it has none. */
  icon: string
}

/**
 * An entry that went with a deleted folder, and where it used to sit.
 *
 * What the caller needs to finish the job: the row behind it to delete, and enough to say what was
 * deleted once nothing in the database records that any more.
 */
export interface DeletedEntry {
  id: string
  /** Slash-separated, without the file name. Empty at the site root. */
  folderPath: string
  fileName: string
  locale: string
}

/** A raw `tree` row, as the model passes it around internally. */
export interface TreeRow {
  id: string
  folderPath: string | null
  fileName: string
  type: TreeItemType
  locale: string
  title: string
  tags: string[]
  meta: Record<string, any>
  siteId: string
  createdAt: Date
  updatedAt: Date
}

/** Folders are addressed by URL, so their file name is restricted to what reads well in one. */
const rePathName = /^[a-z0-9-]+$/
const reTitle = /^[^<>"]+$/

/** Ceiling on how many entries one listing returns, and how deep it may recurse. */
const MAX_LIMIT = 1000
const MAX_DEPTH = 10

/** Ceiling on how many entries one browse level returns. */
const MAX_BROWSE = 500

/** How many `name-1`, `name-2`… variants an upload will try before giving up on the name. */
const MAX_NAME_ATTEMPTS = 100

/**
 * The ltree path of a folder's *contents*, i.e. the value its children carry in `folderPath`.
 */
function childPathOf(folder: { folderPath?: string | null; fileName: string }): string {
  return folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName
}

/**
 * Split an ltree path into the (folderPath, fileName) pair that addresses the entry itself.
 */
function splitPath(path: string): { folderPath: string; fileName: string } {
  const parts = path.split('.')
  return {
    folderPath: parts.slice(0, -1).join('.'),
    fileName: parts.at(-1) ?? ''
  }
}

/**
 * Turn a row into the shape the API returns.
 */
function toTreeItem(row: TreeRow, depth: number, parentPath: string): TreeItem {
  const folderPath = row.folderPath ?? ''
  return {
    id: row.id,
    type: row.type,
    depth,
    folderPath: decodeTreePath(folderPath) ?? '',
    fileName: row.fileName,
    title: row.title,
    tags: row.tags ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.type === 'folder' && {
      childrenCount: row.meta?.children ?? 0,
      // -> No default: an uncoloured folder carries no hue rather than a zero, which is what lets the
      //    interface draw it with no filter at all
      ...(row.meta?.hue ? { hue: row.meta.hue } : {}),
      // -> Shorter than the folder being listed means it sits above it, so it came from
      //    `includeAncestors` / `includeRootFolders` rather than from the listing itself
      isAncestor: folderPath.length < parentPath.length
    }),
    ...(row.type === 'asset' && {
      fileSize: row.meta?.fileSize ?? 0,
      fileExt: row.meta?.fileExt ?? '',
      mimeType: row.meta?.mimeType ?? '',
      // -> No default, unlike the rest: a file whose dimensions were never read has none rather than
      //    being zero pixels across, and the file manager shows the row only for one that has them
      ...(row.meta?.width && row.meta?.height
        ? { width: row.meta.width, height: row.meta.height }
        : {})
    }),
    ...(row.type === 'page' && {
      editor: row.meta?.editor ?? '',
      description: row.meta?.description ?? ''
    })
  }
}

/**
 * What a page has to be for a reader to be shown that it exists.
 *
 * Deliberately the same rule the page view itself applies (see `pages.getPage`'s `publicOnly`), so
 * that a menu never offers a page that would answer 404 — nor hides one that would open.
 *
 * A password-protected page is listed. It is not hidden but locked: opening it puts the reader in
 * front of the unlock prompt, which is exactly where someone who has the password wants to end up,
 * and its title is metadata rather than protected content.
 *
 * The columns come in one by one rather than as a table, because this is applied both to `pages` and
 * to an alias of it, and an alias is a different type.
 *
 * @param publicOnly Restrict to what a reader with no session may see. `isBrowsable` applies either
 *                   way: it is the author saying "not in the tree", not an access rule.
 */
function pageIsVisible(
  columns: { isBrowsable: PgColumn; publishState: PgColumn },
  publicOnly: boolean
): (SQL | undefined)[] {
  return [
    eq(columns.isBrowsable, true),
    ...(publicOnly ? [eq(columns.publishState, 'published')] : [])
  ]
}

/**
 * Tree model
 *
 * The tree is the single index of everything addressable in a site — folders, pages and assets alike
 * — keyed by an ltree `folderPath`. Pages and assets keep their own rows elsewhere and join back on
 * the same ID; the tree row is what gives them a place and a name.
 *
 * Paths are slashes on the way in and out (`foo/bar`) and dots inside the database (`foo.bar`), which
 * is what `encodeTreePath` / `decodeTreePath` convert between. Nothing outside this model should have
 * to know about the dotted form.
 */
class Tree {
  /**
   * List the contents of a folder.
   *
   * @param parentId UUID of the folder to list. Takes precedence over `parentPath`.
   * @param parentPath Slash-separated path of the folder to list. The site root when both are absent.
   * @param depth How many levels below the folder to include. 0, the default, is the folder itself.
   * @param includeAncestors Also return every folder between the root and the one being listed, so a
   *                         caller opening a deep folder gets the branch it hangs off in one request.
   * @param includeRootFolders Also return every folder at the root, for the same reason.
   */
  async getTree({
    siteId,
    parentId,
    parentPath,
    locale,
    types,
    tags,
    limit = MAX_LIMIT,
    offset = 0,
    orderBy = 'title',
    orderByDirection = 'asc',
    depth = 0,
    includeAncestors = false,
    includeRootFolders = false
  }: {
    siteId: string
    parentId?: string | null
    parentPath?: string | null
    locale?: string | null
    types?: TreeItemType[] | null
    tags?: string[] | null
    limit?: number
    offset?: number
    orderBy?: TreeOrderBy
    orderByDirection?: 'asc' | 'desc'
    depth?: number
    includeAncestors?: boolean
    includeRootFolders?: boolean
  }): Promise<TreeItem[]> {
    if (offset < 0) {
      throw new CustomError('treeInvalidOffset', 'The offset cannot be negative.')
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new CustomError('treeInvalidLimit', `The limit must be between 1 and ${MAX_LIMIT}.`)
    }
    if (depth < 0 || depth > MAX_DEPTH) {
      throw new CustomError('treeInvalidDepth', `The depth must be between 0 and ${MAX_DEPTH}.`)
    }

    // -> Resolve what to list into the ltree path its children carry
    let path = ''
    if (parentId) {
      const parent = await this.getFolderById(parentId)
      if (parent) {
        path = childPathOf(parent)
      }
    } else if (parentPath) {
      path = encodeTreePath(parentPath)
    }

    const levels = depth > 0 ? `*{,${depth}}` : '*{0}'
    const pathQuery = path ? `${path}.${levels}` : levels

    const locations: SQL[] = [sql`${treeTable.folderPath} ~ ${pathQuery}::lquery`]
    if (includeAncestors && path) {
      // -> Each iteration drops one level off the end, walking the branch back up to the root
      const parts = path.split('.')
      for (let i = 0; i < parts.length; i++) {
        locations.push(
          and(
            eq(treeTable.folderPath, parts.slice(0, parts.length - 1 - i).join('.')),
            eq(treeTable.fileName, parts[parts.length - 1 - i]),
            eq(treeTable.type, 'folder')
          )!
        )
      }
    }
    if (includeRootFolders) {
      locations.push(and(eq(treeTable.folderPath, ''), eq(treeTable.type, 'folder'))!)
    }

    const conditions: (SQL | undefined)[] = [eq(treeTable.siteId, siteId), or(...locations)]
    if (locale) {
      conditions.push(eq(treeTable.locale, locale))
    }
    if (types && types.length > 0) {
      conditions.push(inArray(treeTable.type, types))
    }
    if (tags && tags.length > 0) {
      // -> `sql.param`, because a bare array in a template is read as a parameter *list* — the
      //    comma-separated form `inArray` needs — and `@>` wants one array-typed parameter
      conditions.push(sql`${treeTable.tags} @> ${sql.param(tags)}`)
    }

    const direction = orderByDirection === 'desc' ? desc : asc
    const rows = await WIKI.db
      .select({
        row: treeTable,
        depth: sql<number>`nlevel(${treeTable.folderPath})`.mapWith(Number)
      })
      .from(treeTable)
      .where(and(...conditions))
      .orderBy(asc(sql`nlevel(${treeTable.folderPath})`), direction(treeTable[orderBy]))
      .limit(limit)
      .offset(offset)

    return rows.map(({ row, depth: rowDepth }) => toTreeItem(row as TreeRow, rowDepth, path))
  }

  /**
   * List the pages under a path, the way an index block on a page lists them.
   *
   * Between `getTree()` and `browse()`: it recurses and sorts like the first and hides like the
   * second. Folders are left out entirely — the block draws a list of pages, not a file browser —
   * and so is any page the reader may not open, by the same rule the page view applies.
   *
   * @param path Slash-separated path to list. The site root when empty.
   * @param depth How many folders below the path to include. 0, the default, is the path itself.
   * @param tags Only pages carrying every one of these tags.
   * @param publicOnly Restrict to what a reader with no session may see. See `pageIsVisible`.
   */
  async listPages({
    siteId,
    path,
    locale,
    tags,
    limit = 10,
    orderBy = 'title',
    orderByDirection = 'asc',
    depth = 0,
    publicOnly = true
  }: {
    siteId: string
    path?: string | null
    locale: string
    tags?: string[] | null
    limit?: number
    orderBy?: TreeOrderBy
    orderByDirection?: 'asc' | 'desc'
    depth?: number
    publicOnly?: boolean
  }): Promise<ListedPage[]> {
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new CustomError('treeInvalidLimit', `The limit must be between 1 and ${MAX_LIMIT}.`)
    }
    if (depth < 0 || depth > MAX_DEPTH) {
      throw new CustomError('treeInvalidDepth', `The depth must be between 0 and ${MAX_DEPTH}.`)
    }

    const encodedPath = encodeTreePath(path)
    const levels = depth > 0 ? `*{,${depth}}` : '*{0}'
    const pathQuery = encodedPath ? `${encodedPath}.${levels}` : levels

    const direction = orderByDirection === 'desc' ? desc : asc
    const rows = await WIKI.db
      .select({
        id: treeTable.id,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        title: treeTable.title,
        description: pagesTable.description,
        icon: pagesTable.icon
      })
      .from(treeTable)
      .innerJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          eq(treeTable.type, 'page'),
          sql`${treeTable.folderPath} ~ ${pathQuery}::lquery`,
          ...(tags && tags.length > 0 ? [sql`${treeTable.tags} @> ${sql.param(tags)}`] : []),
          ...pageIsVisible(pagesTable, publicOnly)
        )
      )
      .orderBy(direction(treeTable[orderBy]))
      .limit(limit)

    return rows.map((row) => {
      const folderPath = decodeTreePath(row.folderPath ?? '') ?? ''
      return {
        id: row.id,
        path: folderPath ? `${folderPath}/${row.fileName}` : row.fileName,
        title: row.title,
        description: row.description ?? '',
        icon: row.icon ?? ''
      }
    })
  }

  /**
   * List one folder the way a reader browses it: the pages they may open and the folders worth
   * opening, and nothing else.
   *
   * Not a variant of `getTree()`. That one is the file manager's view — every entry of every kind,
   * for someone with permission to manage them. This is the reader's: assets have no place in it,
   * a page nobody may see must not appear even as a name, and a folder whose whole contents are
   * invisible is a dead end rather than something to offer.
   *
   * @param path Slash-separated path of the folder to list. The site root when empty.
   * @param publicOnly Restrict pages to what a reader with no session may see. See `pageIsVisible`.
   * @returns The level, or null when there is no such folder
   */
  async browse({
    siteId,
    path,
    locale,
    publicOnly = true
  }: {
    siteId: string
    path?: string | null
    locale: string
    publicOnly?: boolean
  }): Promise<BrowseLevel | null> {
    const encodedPath = encodeTreePath(path)
    const basePath = decodeTreePath(encodedPath) ?? ''

    // -> What the level is called. The root is not a folder, so it has no row and no title of its own
    //    — and a path that is not a folder is nothing this can list.
    let title = ''
    if (encodedPath) {
      const location = splitPath(encodedPath)
      const folder = await WIKI.db
        .select({ title: treeTable.title })
        .from(treeTable)
        .where(
          and(
            eq(treeTable.siteId, siteId),
            eq(treeTable.locale, locale),
            eq(treeTable.folderPath, location.folderPath),
            eq(treeTable.fileName, location.fileName),
            eq(treeTable.type, 'folder')
          )
        )
        .limit(1)
      if (!folder[0]) {
        return null
      }
      title = folder[0].title
    }

    const descendant = alias(treeTable, 'descendantTree')
    const descendantPage = alias(pagesTable, 'descendantPage')
    // -> Text rather than an ltree operator, so that the child path can be built from a bound prefix
    //    and the row's own name: `foo.bar.` + `baz`
    const childPathPrefix = encodedPath ? `${encodedPath}.` : ''

    /*
      Whether a folder holds a page a reader may open, at any depth below it.

      A folder is created for whatever is put in it, so it can end up holding only assets, only
      drafts, or nothing at all — descending into any of those lands on an empty menu. `EXISTS` stops
      at the first hit, so this costs an index lookup per folder in the level rather than a count.
    */
    const holdsVisiblePages = exists(
      WIKI.db
        .select({ one: sql`1` })
        .from(descendant)
        .innerJoin(descendantPage, eq(descendantPage.id, descendant.id))
        .where(
          and(
            eq(descendant.siteId, treeTable.siteId),
            eq(descendant.locale, treeTable.locale),
            eq(descendant.type, 'page'),
            sql`${descendant.folderPath} <@ (${childPathPrefix}::text || ${treeTable.fileName})::ltree`,
            ...pageIsVisible(descendantPage, publicOnly)
          )
        )
    )

    /*
      Ordered by file name rather than by title, so that a page and the folder at the same path are
      adjacent: the row after `MAX_BROWSE` is dropped, and only a pair straddling that boundary can
      lose half of itself. Display order is settled below, once the pairs are merged.
    */
    const rows = await WIKI.db
      .select({
        type: treeTable.type,
        fileName: treeTable.fileName,
        title: treeTable.title,
        icon: pagesTable.icon,
        holdsVisiblePages: sql<boolean>`${holdsVisiblePages}`.mapWith(Boolean)
      })
      .from(treeTable)
      .leftJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          eq(treeTable.folderPath, encodedPath),
          or(
            eq(treeTable.type, 'folder'),
            and(eq(treeTable.type, 'page'), ...pageIsVisible(pagesTable, publicOnly))
          )
        )
      )
      .orderBy(asc(treeTable.fileName))
      .limit(MAX_BROWSE + 1)

    const merged = new Map<string, BrowseItem>()
    for (const row of rows.slice(0, MAX_BROWSE)) {
      if (row.type === 'folder' && !row.holdsVisiblePages) {
        continue
      }
      const entry = merged.get(row.fileName) ?? {
        path: basePath ? `${basePath}/${row.fileName}` : row.fileName,
        fileName: row.fileName,
        title: row.title,
        icon: null,
        isPage: false,
        isFolder: false
      }
      if (row.type === 'folder') {
        entry.isFolder = true
      } else {
        entry.isPage = true
        // -> The page is the thing a reader clicks, so it names the row when both exist
        entry.title = row.title
        entry.icon = row.icon
      }
      merged.set(row.fileName, entry)
    }

    return {
      path: basePath,
      title,
      truncated: rows.length > MAX_BROWSE,
      // -> Folders first, as a file browser lists them; an entry that is both belongs with them
      items: [...merged.values()].sort((a, b) =>
        a.isFolder === b.isFolder ? a.title.localeCompare(b.title) : a.isFolder ? -1 : 1
      )
    }
  }

  /**
   * A single tree row by ID, or null if there is no such row
   */
  async getById(id: string): Promise<TreeRow | null> {
    const results = await WIKI.db.select().from(treeTable).where(eq(treeTable.id, id)).limit(1)
    return (results[0] as TreeRow) ?? null
  }

  /**
   * A single folder by ID, or null if the ID is not a folder
   */
  async getFolderById(id: string): Promise<TreeRow | null> {
    const results = await WIKI.db
      .select()
      .from(treeTable)
      .where(and(eq(treeTable.id, id), eq(treeTable.type, 'folder')))
      .limit(1)
    return (results[0] as TreeRow) ?? null
  }

  /**
   * Whatever already sits at a name inside a folder, or null if the name is free.
   *
   * The question an upload has to ask before it writes anything, since what is there decides whether
   * the file replaces it, is refused, or takes the next free name. A folder that does not exist holds
   * nothing, so an unresolvable destination answers null rather than raising: the caller is about to
   * create it.
   *
   * @param parentId UUID of the folder to look in. Takes precedence over `parentPath`; the site root
   *                 when both are absent.
   */
  async getEntryAt({
    siteId,
    locale,
    parentId,
    parentPath,
    fileName
  }: {
    siteId: string
    locale: string
    parentId?: string | null
    parentPath?: string | null
    fileName: string
  }): Promise<TreeRow | null> {
    let path = ''
    if (parentId || parentPath) {
      let folder: TreeRow
      try {
        folder = await this.getFolder({ id: parentId, path: parentPath, locale, siteId })
      } catch {
        return null
      }
      path = childPathOf(folder)
    }

    const results = await WIKI.db
      .select()
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          eq(treeTable.folderPath, path),
          eq(treeTable.fileName, fileName)
        )
      )
      .limit(1)
    return (results[0] as TreeRow) ?? null
  }

  /**
   * Resolve a folder, either by ID or by path.
   *
   * @param createIfMissing Create the folder, and any ancestor it needs, when the path has none. Only
   *                        applies when resolving by path — an ID that matches nothing is an error
   *                        either way.
   */
  async getFolder({
    id,
    path,
    locale,
    siteId,
    createIfMissing = false
  }: {
    id?: string | null
    path?: string | null
    locale?: string
    siteId?: string
    createIfMissing?: boolean
  }): Promise<TreeRow> {
    if (id) {
      const folder = await this.getFolderById(id)
      if (!folder) {
        throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
      }
      return folder
    }

    const { folderPath, fileName } = splitPath(encodeTreePath(path))
    const results = await WIKI.db
      .select()
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId!),
          eq(treeTable.locale, locale!),
          eq(treeTable.folderPath, folderPath),
          eq(treeTable.fileName, fileName),
          eq(treeTable.type, 'folder')
        )
      )
      .limit(1)
    if (results[0]) {
      return results[0] as TreeRow
    }
    if (!createIfMissing) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    return this.createFolder({
      parentPath: folderPath,
      pathName: fileName,
      title: fileName,
      locale: locale!,
      siteId: siteId!
    })
  }

  /**
   * Create a folder, and any of its ancestors that do not exist yet.
   *
   * @param parentId UUID of the folder to create it in. Takes precedence over `parentPath`.
   * @param parentPath Slash-separated path of the folder to create it in. The root when both are absent.
   * @param pathName The folder's own path segment. Normalized the way a page path is, so what the
   *                 folder ends up called may differ from what was asked for.
   */
  async createFolder({
    parentId,
    parentPath,
    pathName,
    title,
    locale,
    siteId
  }: {
    parentId?: string | null
    parentPath?: string | null
    pathName: string
    title: string
    locale: string
    siteId: string
  }): Promise<TreeRow> {
    // -> A folder name is a segment of every page path under it, so it is normalized the same way a
    //    page path is before it is held to what a segment may contain
    const name = normalizePagePath(pathName)
    if (!rePathName.test(name)) {
      throw new CustomError(
        'treeInvalidPath',
        'A folder path name may only contain lowercase alphanumeric and hyphen characters.'
      )
    }
    if (!reTitle.test(title)) {
      throw new CustomError('treeInvalidTitle', 'The folder title contains invalid characters.')
    }

    // -> Resolve where it goes, as the ltree path the new folder will carry
    let path = encodeTreePath(parentPath)
    let effectiveLocale = locale
    if (parentId) {
      const parent = await this.getFolderById(parentId)
      if (!parent) {
        throw new CustomError('treeInvalidParent', 'The parent folder does not exist.', 404)
      }
      path = childPathOf(parent)
      // -> A folder cannot be in a different locale than the one holding it
      effectiveLocale = parent.locale
    }

    // -> A page here is not in the way: a folder alongside it is how `/guide` gets to be both a page
    //    and the way into `/guide/…`. An asset is, since it is served at that URL itself — the same
    //    rule `resolveName` applies coming the other way.
    const existing = await WIKI.db
      .select({ type: treeTable.type })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, effectiveLocale),
          eq(treeTable.folderPath, path),
          eq(treeTable.fileName, name),
          ne(treeTable.type, 'page')
        )
      )
      .limit(1)
    if (existing.length > 0) {
      throw new CustomError(
        'treeFolderDuplicate',
        existing[0].type === 'folder'
          ? 'A folder with this path name already exists.'
          : 'A file with this path name already exists here.',
        409
      )
    }

    // -> A path can be created from the middle out — by an upload into a folder nobody made yet, or by
    //    a rename that left a gap — so every level above the new folder is filled in first
    if (path) {
      const parts = path.split('.')
      const expected = parts.map((_, i) => ({
        folderPath: parts.slice(0, i).join('.'),
        fileName: parts[i]
      }))
      const found = await WIKI.db
        .select({ folderPath: treeTable.folderPath, fileName: treeTable.fileName })
        .from(treeTable)
        .where(
          and(
            eq(treeTable.siteId, siteId),
            eq(treeTable.locale, effectiveLocale),
            eq(treeTable.type, 'folder'),
            or(
              ...expected.map((ancestor) =>
                and(
                  eq(treeTable.folderPath, ancestor.folderPath),
                  eq(treeTable.fileName, ancestor.fileName)
                )!
              )
            )
          )
        )
      const missing = expected.filter(
        (ancestor) =>
          !found.some(
            (row) =>
              (row.folderPath ?? '') === ancestor.folderPath && row.fileName === ancestor.fileName
          )
      )
      // -> Shallowest first, so that each one's own parent is already there to be counted against
      for (const ancestor of missing) {
        WIKI.logger.debug(
          `Creating missing parent folder ${ancestor.fileName} at path /${decodeTreePath(ancestor.folderPath)}...`
        )
        const ancestorFullPath = ancestor.folderPath
          ? `${decodeTreePath(ancestor.folderPath)}/${ancestor.fileName}`
          : ancestor.fileName
        await WIKI.db.insert(treeTable).values({
          folderPath: ancestor.folderPath,
          fileName: ancestor.fileName,
          type: 'folder',
          title: ancestor.fileName,
          hash: generateHash(ancestorFullPath),
          locale: effectiveLocale,
          siteId,
          meta: { children: 0 }
        })
        await this.countTowardsFolderAt(siteId, effectiveLocale, ancestor.folderPath, 1)
      }
    }

    const fullPath = path ? `${decodeTreePath(path)}/${name}` : name
    const inserted = await WIKI.db
      .insert(treeTable)
      .values({
        folderPath: path,
        fileName: name,
        type: 'folder',
        title,
        hash: generateHash(fullPath),
        locale: effectiveLocale,
        siteId,
        meta: { children: 0 }
      })
      .returning()

    await this.countTowardsFolderAt(siteId, effectiveLocale, path, 1)

    WIKI.logger.debug(`Created folder ${inserted[0].id} successfully.`)
    return inserted[0] as TreeRow
  }

  /**
   * Rename a folder, moving everything under it along with it.
   *
   * @param pathName The new path segment, normalized as on the way in. Unchanged from the current
   *                 one when only the title differs, which leaves every descendant's path untouched.
   */
  async renameFolder({
    folderId,
    pathName,
    title,
    actorId
  }: {
    folderId: string
    pathName: string
    title: string
    /** Who is renaming it, for a target that records who moved a file. */
    actorId?: string
  }): Promise<TreeRow> {
    const folder = await this.getFolderById(folderId)
    if (!folder) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    // -> Normalized as it is on the way in, since this renames the segment every page path under the
    //    folder is built from
    const name = normalizePagePath(pathName)
    if (!rePathName.test(name)) {
      throw new CustomError(
        'treeInvalidPath',
        'A folder path name may only contain lowercase alphanumeric and hyphen characters.'
      )
    }
    if (!reTitle.test(title)) {
      throw new CustomError('treeInvalidTitle', 'The folder title contains invalid characters.')
    }

    if (name === folder.fileName) {
      const updated = await WIKI.db
        .update(treeTable)
        .set({ title, updatedAt: sql`now()` })
        .where(eq(treeTable.id, folder.id))
        .returning()
      return updated[0] as TreeRow
    }

    // -> As on the way in: a page may share the name, an asset may not
    const existing = await WIKI.db
      .select({ type: treeTable.type })
      .from(treeTable)
      .where(
        and(
          ne(treeTable.id, folder.id),
          eq(treeTable.siteId, folder.siteId),
          eq(treeTable.locale, folder.locale),
          eq(treeTable.folderPath, folder.folderPath ?? ''),
          eq(treeTable.fileName, name),
          ne(treeTable.type, 'page')
        )
      )
      .limit(1)
    if (existing.length > 0) {
      throw new CustomError(
        'treeFolderDuplicate',
        existing[0].type === 'folder'
          ? 'A folder with this path name already exists.'
          : 'A file with this path name already exists here.',
        409
      )
    }

    const oldPath = childPathOf(folder)
    const newPath = folder.folderPath ? `${folder.folderPath}.${name}` : name

    WIKI.logger.debug(`Renaming folder ${folder.id} from ${oldPath} to ${newPath}...`)

    /*
      Direct children carry the old path verbatim; deeper ones carry it as a prefix, and keep whatever
      they had below it.

      Scoped to this folder's locale, as everything below is: the tree holds every translation side by
      side, so a path names one folder per locale, and without this renaming the English `/guides`
      dragged the French one's children to a path their own folder row did not have.
    */
    await WIKI.db
      .update(treeTable)
      .set({ folderPath: newPath })
      .where(
        and(
          eq(treeTable.siteId, folder.siteId),
          eq(treeTable.locale, folder.locale),
          eq(treeTable.folderPath, oldPath)
        )
      )
    await WIKI.db
      .update(treeTable)
      .set({
        folderPath: sql`${newPath}::ltree || subpath(${treeTable.folderPath}, nlevel(${newPath}::ltree))`
      })
      .where(
        and(
          eq(treeTable.siteId, folder.siteId),
          eq(treeTable.locale, folder.locale),
          sql`${treeTable.folderPath} <@ ${oldPath}::ltree`
        )
      )

    const fullPath = folder.folderPath ? `${decodeTreePath(folder.folderPath)}/${name}` : name
    const updated = await WIKI.db
      .update(treeTable)
      .set({ fileName: name, title, hash: generateHash(fullPath), updatedAt: sql`now()` })
      .where(eq(treeTable.id, folder.id))
      .returning()

    const movedPages = await this.refreshDescendantPaths(folder.siteId, folder.locale, newPath)

    // -> Only moved, never rewritten: none of these pages changed, so the copy a target holds is
    //    still the right contents at the wrong name
    for (const page of movedPages) {
      await WIKI.models.storage.relocatePage(
        {
          id: page.id,
          siteId: folder.siteId,
          actorId,
          locale: page.locale,
          path: page.path,
          contentType: page.contentType
        },
        // -> A folder rename never crosses locales, so the page's own is where it came from too
        { locale: page.locale, path: page.previousPath }
      )
    }

    // -> A storage target that lays its content out by path has every one of those files to move.
    //    Asked for after the rows are correct, so that where each file belongs is read off the tree
    //    rather than recomputed from the rename.
    const movedAssets = await WIKI.db
      .select({
        id: treeTable.id,
        locale: treeTable.locale,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName
      })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, folder.siteId),
          eq(treeTable.locale, folder.locale),
          eq(treeTable.type, 'asset'),
          sql`${treeTable.folderPath} <@ ${newPath}::ltree`
        )
      )
    await WIKI.models.assets.relocateAssets(
      folder.siteId,
      movedAssets.map((row) => ({
        id: row.id,
        previous: {
          locale: row.locale,
          // -> Where it was: the same place it is now, with the renamed segment put back
          folderPath: (decodeTreePath(row.folderPath ?? '') ?? '').replace(
            decodeTreePath(newPath)!,
            decodeTreePath(oldPath)!
          ),
          fileName: row.fileName
        }
      })),
      actorId
    )

    // -> Every asset under it is served from a different path now, and nothing about the assets
    //    themselves changed for the file cache to notice
    WIKI.models.assets.forgetAllPaths()

    WIKI.logger.debug(`Renamed folder ${folder.id} successfully.`)
    return updated[0] as TreeRow
  }

  /**
   * Copy a folder, and everything under it, to another parent — another locale, and another name.
   *
   * Unlike a move, nothing here is a rewrite: every folder, page and file under the source gets a new
   * row of its own, so the two trees go their separate ways from this moment. That is also why each
   * copy goes through the model that owns it rather than through an INSERT ... SELECT — a copied page
   * is rendered, indexed, given its own history and written to every storage target, and a copied file
   * gets its own thumbnail and its own bytes on every target. A folder of a few hundred pages is
   * therefore a slow request, and deliberately so: half a copy is worse than a slow one.
   *
   * What is deliberately not carried across:
   *
   * - **Aliases**, which are unique per site: a copy cannot have the original's, and inventing one is
   *   not this operation's business.
   * - **Translation sets**: a copy is a new page, not another language's version of an existing one.
   * - **Sidebar overrides**, so the copies inherit the menu of wherever they land — which for a copy
   *   into another locale is the only sensible answer anyway.
   *
   * Folder colours ARE carried across, since they are how somebody has arranged their tree.
   *
   * @param folderPath Slash-separated path of the folder to copy into, empty for the site root.
   * @param pathName What to call the copy. The name it collides on, and the one that must be free.
   * @param title The copy's title.
   * @param locale The locale to copy into. The source's own when absent.
   */
  async duplicateFolder({
    folderId,
    folderPath,
    pathName,
    title,
    locale,
    actor
  }: {
    folderId: string
    folderPath: string
    pathName: string
    title: string
    locale?: string
    /** Who is copying, which is who the copied pages and files are authored by. */
    actor: PageActor
  }): Promise<TreeRow> {
    const source = await this.getFolderById(folderId)
    if (!source) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    const siteId = source.siteId
    const destinationLocale = locale || source.locale
    const requested = normalizeFolderPath(folderPath)
    const sourcePath = childPathOf(source)
    const ownPath = decodeTreePath(sourcePath) ?? ''

    // -> On the paths, before anything is created: a folder copied into its own subtree would be
    //    copying into what it is still reading from
    if (
      destinationLocale === source.locale &&
      (requested === ownPath || requested.startsWith(`${ownPath}/`))
    ) {
      throw new CustomError(
        'treeFolderIntoItself',
        'A folder cannot be copied into itself or into one of its own subfolders.',
        400
      )
    }

    /*
      Read before the copy starts, and in one go: the walk below creates folders as it goes, and a
      scan that ran alongside it would find them. Shallowest first, so each entry's own parent has
      already been created by the time it is reached.
    */
    const descendants = await WIKI.db
      .select({
        id: treeTable.id,
        type: treeTable.type,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        title: treeTable.title,
        // -> Cast because Drizzle types a jsonb column as `{}` until something says otherwise, and
        //    what this reads out of it is the folder's colour
        meta: sql<Record<string, any>>`${treeTable.meta}`
      })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, source.locale),
          sql`${treeTable.folderPath} <@ ${sourcePath}::ltree`
        )
      )
      .orderBy(sql`nlevel(${treeTable.folderPath})`, treeTable.fileName)

    // -> `createFolder` is what refuses a name already taken there, so this is also the collision
    //    check -- and it makes it before creating anything, including the folders the path needs
    const copy = await this.createFolder({
      siteId,
      locale: destinationLocale,
      parentPath: requested,
      pathName,
      title
    })
    if (source.meta?.hue) {
      await this.setFolderColor({ folderId: copy.id, hue: source.meta.hue })
    }

    const copyPath = childPathOf(copy)
    const newPrefix = decodeTreePath(copyPath) ?? ''
    /** Where an entry under the source sits under the copy, as a slash-separated folder path. */
    const mapFolder = (path: string | null) =>
      `${newPrefix}${(decodeTreePath(path ?? '') ?? '').slice(ownPath.length)}`

    WIKI.logger.debug(
      `Copying folder ${source.id} and ${descendants.length} descendant(s) to ${destinationLocale}:${copyPath}...`
    )

    for (const entry of descendants) {
      const parentPath = mapFolder(entry.folderPath)
      switch (entry.type) {
        case 'folder': {
          const folderCopy = await this.createFolder({
            siteId,
            locale: destinationLocale,
            parentPath,
            pathName: entry.fileName,
            title: entry.title
          })
          if (entry.meta?.hue) {
            await this.setFolderColor({ folderId: folderCopy.id, hue: entry.meta.hue })
          }
          break
        }
        case 'page': {
          const page = await WIKI.models.pages.getPage({
            siteId,
            id: entry.id,
            withContent: true,
            withPassword: true
          })
          if (!page) {
            break
          }
          await WIKI.models.pages.createPage(
            siteId,
            {
              path: parentPath ? `${parentPath}/${entry.fileName}` : entry.fileName,
              locale: destinationLocale,
              title: page.title,
              description: page.description ?? '',
              icon: page.icon ?? '',
              editor: page.editor,
              content: page.content ?? '',
              render: page.render,
              publishState: page.publishState,
              publishStartDate: page.publishStartDate?.toISOString() ?? null,
              publishEndDate: page.publishEndDate?.toISOString() ?? null,
              isBrowsable: page.isBrowsable,
              isSearchable: page.isSearchable,
              password: page.password ?? '',
              relations: page.relations,
              tags: page.tags,
              allowComments: page.allowComments,
              allowContributions: page.allowContributions,
              allowRatings: page.allowRatings,
              showSidebar: page.showSidebar,
              showTags: page.showTags
            },
            actor
          )
          break
        }
        case 'asset': {
          const content = await WIKI.models.assets.getContent(entry.id)
          if (!content) {
            // -> Its bytes are gone, which is a broken file rather than a reason to fail the copy
            WIKI.logger.warn(`Skipped copying ${entry.fileName}: it has no content.`)
            break
          }
          await WIKI.models.assets.upload({
            siteId,
            locale: destinationLocale,
            folderPath: parentPath,
            fileName: entry.fileName,
            mimeType: content.mimeType,
            data: content.data,
            authorId: actor.id
          })
          break
        }
      }
    }

    WIKI.logger.debug(`Copied folder ${source.id} successfully.`)
    // -> Read back rather than returned as created: the copy was an empty folder at that point, and
    //    answering with a child count of zero for a folder that now holds a branch is a lie the
    //    caller would draw
    return (await this.getFolderById(copy.id)) ?? copy
  }

  /**
   * Colour a folder's icon, or put it back to the colour every folder starts out.
   *
   * Stored as a hue rotation in degrees rather than as a colour, because that is what is actually
   * applied: the folder icon is one yellow image and the interface turns it around the colour wheel,
   * so a wiki that restyles that icon keeps every folder's choice meaningful. Zero is therefore not a
   * colour but the absence of one, and is stored by removing the key -- a folder nobody has coloured
   * and one put back to yellow are the same folder.
   *
   * `meta` also carries the folder's child count, so this edits the one key rather than replacing the
   * object: the count is maintained in postgres by whoever adds or removes an entry, and a
   * read-modify-write here would lose whatever landed in between.
   *
   * @param hue Degrees around the colour wheel, 0 to 359. Zero clears it.
   */
  async setFolderColor({ folderId, hue }: { folderId: string; hue: number }): Promise<TreeRow> {
    const folder = await this.getFolderById(folderId)
    if (!folder) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    if (!Number.isInteger(hue) || hue < 0 || hue > 359) {
      throw new CustomError('treeInvalidHue', 'A folder colour must be a hue between 0 and 359.')
    }
    const updated = await WIKI.db
      .update(treeTable)
      .set({
        meta: hue
          ? sql`jsonb_set(${treeTable.meta}, '{hue}', to_jsonb(${hue}::int))`
          : sql`${treeTable.meta} - 'hue'`,
        updatedAt: sql`now()`
      })
      .where(eq(treeTable.id, folder.id))
      .returning()
    return updated[0] as TreeRow
  }

  /**
   * Move a folder to another parent, another locale, or both — everything under it going along.
   *
   * The same rewrite a rename does, with the folder's own parent changing rather than its name, and
   * with a locale that may change too. That makes it several operations at once, and the order below
   * is what keeps them consistent:
   *
   * 1. **Nothing is created before the move is known to be legal.** The destination is resolved with
   *    `createIfMissing`, so a folder asked to move inside itself would otherwise leave a new folder
   *    behind on the way to being refused. Both refusals are therefore decided on the paths alone,
   *    before anything is looked up.
   * 2. **Pages leave their translation sets before their locale is rewritten**, since a set holds one
   *    page per locale and the index enforcing it would refuse the second arrival.
   * 3. **The rows move, then everything derived from them is rebuilt** — the hashes an entry is found
   *    by, the second copy of its path each page keeps, the sidebar each entry inherits, and the copy
   *    every storage target holds. Each of those reads the tree back rather than being computed from
   *    the move, so there is one answer to where a thing is and it is the row.
   *
   * A collision cannot come from below: the destination is refused if anything but a page is already
   * called this there, and nothing can sit under a folder path that does not exist — so once the
   * folder itself fits, every descendant does.
   *
   * @param folderPath Slash-separated path of the folder to move into, empty for the site root.
   *                   Created if it does not exist.
   * @param locale The locale to move it to. Stays in its own when absent.
   */
  async moveFolder({
    folderId,
    folderPath,
    locale,
    actorId
  }: {
    folderId: string
    folderPath: string
    locale?: string
    /** Who is moving it, for a target that records who moved a file. */
    actorId?: string
  }): Promise<TreeRow> {
    const folder = await this.getFolderById(folderId)
    if (!folder) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    const siteId = folder.siteId
    const destinationLocale = locale || folder.locale
    const oldParentPath = folder.folderPath ?? ''
    const oldPath = childPathOf(folder)
    const requested = normalizeFolderPath(folderPath)
    const ownPath = decodeTreePath(oldPath) ?? ''

    // -> Decided on the paths, before the destination is resolved: resolving it would create it, and
    //    a folder moved inside itself would take its own subtree out of the tree entirely
    if (
      destinationLocale === folder.locale &&
      (requested === ownPath || requested.startsWith(`${ownPath}/`))
    ) {
      throw new CustomError(
        'treeFolderIntoItself',
        'A folder cannot be moved into itself or into one of its own subfolders.',
        400
      )
    }

    const parent = requested
      ? await this.getFolder({
          path: requested,
          locale: destinationLocale,
          siteId,
          createIfMissing: true
        })
      : null
    const newParentPath = parent ? childPathOf(parent) : ''
    if (newParentPath === oldParentPath && destinationLocale === folder.locale) {
      return folder
    }

    // -> As on the way in: a page may share the name of the folder holding the pages below it, an
    //    asset may not, and neither may another folder
    const existing = await WIKI.db
      .select({ type: treeTable.type })
      .from(treeTable)
      .where(
        and(
          ne(treeTable.id, folder.id),
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, destinationLocale),
          eq(treeTable.folderPath, newParentPath),
          eq(treeTable.fileName, folder.fileName),
          ne(treeTable.type, 'page')
        )
      )
      .limit(1)
    if (existing.length > 0) {
      throw new CustomError(
        'treeFolderDuplicate',
        existing[0].type === 'folder'
          ? 'A folder with this path name already exists there.'
          : 'A file with this path name already exists there.',
        409
      )
    }

    const newPath = newParentPath ? `${newParentPath}.${folder.fileName}` : folder.fileName
    const isLocaleChange = destinationLocale !== folder.locale

    WIKI.logger.debug(
      `Moving folder ${folder.id} from ${folder.locale}:${oldPath} to ${destinationLocale}:${newPath}...`
    )

    const descendants = await WIKI.db
      .select({ id: treeTable.id, type: treeTable.type })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, folder.locale),
          sql`${treeTable.folderPath} <@ ${oldPath}::ltree`
        )
      )
    const pageIds = descendants.filter((row) => row.type === 'page').map((row) => row.id)

    if (isLocaleChange && pageIds.length > 0) {
      await WIKI.models.pages.detachFromLocaleGroups(siteId, pageIds)
    }

    // -> Direct children carry the old path verbatim; deeper ones carry it as a prefix, and keep
    //    whatever they had below it
    const movedLocale = isLocaleChange ? { locale: destinationLocale } : {}
    await WIKI.db
      .update(treeTable)
      .set({ folderPath: newPath, ...movedLocale })
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, folder.locale),
          eq(treeTable.folderPath, oldPath)
        )
      )
    await WIKI.db
      .update(treeTable)
      .set({
        // -> What is dropped is however deep the OLD path was, which is what the row carries; a rename
        //    can use either because the two are the same depth, and a move cannot
        folderPath: sql`${newPath}::ltree || subpath(${treeTable.folderPath}, nlevel(${oldPath}::ltree))`,
        ...movedLocale
      })
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, folder.locale),
          sql`${treeTable.folderPath} <@ ${oldPath}::ltree`
        )
      )
    if (isLocaleChange && pageIds.length > 0) {
      // -> A page keeps its own copy of the locale, as it does of its path, and it is the one a
      //    reader's request resolves against
      await WIKI.db
        .update(pagesTable)
        .set({ locale: destinationLocale })
        .where(and(eq(pagesTable.siteId, siteId), inArray(pagesTable.id, pageIds)))
    }

    const fullPath = newParentPath
      ? `${decodeTreePath(newParentPath)}/${folder.fileName}`
      : folder.fileName
    const updated = await WIKI.db
      .update(treeTable)
      .set({
        folderPath: newParentPath,
        locale: destinationLocale,
        hash: generateHash(fullPath),
        updatedAt: sql`now()`
      })
      .where(eq(treeTable.id, folder.id))
      .returning()

    const movedPages = await this.refreshDescendantPaths(siteId, destinationLocale, newPath)

    // -> Only moved, never rewritten: none of these pages changed, so the copy a target holds is
    //    still the right contents at the wrong place
    for (const page of movedPages) {
      await WIKI.models.storage.relocatePage(
        {
          id: page.id,
          siteId,
          actorId,
          locale: destinationLocale,
          path: page.path,
          contentType: page.contentType
        },
        { locale: folder.locale, path: page.previousPath }
      )
    }

    // -> A storage target that lays its content out by path has every one of those files to move.
    //    Asked for after the rows are correct, so that where each file belongs is read off the tree
    //    rather than recomputed from the move.
    const movedAssets = await WIKI.db
      .select({
        id: treeTable.id,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName
      })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, destinationLocale),
          eq(treeTable.type, 'asset'),
          sql`${treeTable.folderPath} <@ ${newPath}::ltree`
        )
      )
    const newPrefix = decodeTreePath(newPath)!
    const oldPrefix = decodeTreePath(oldPath)!
    await WIKI.models.assets.relocateAssets(
      siteId,
      movedAssets.map((row) => ({
        id: row.id,
        previous: {
          locale: folder.locale,
          // -> Where it was: the same place it is now, with the moved folder's path put back. Sliced
          //    rather than replaced, since the segment that moved can occur again further down.
          folderPath: `${oldPrefix}${(decodeTreePath(row.folderPath ?? '') ?? '').slice(newPrefix.length)}`,
          fileName: row.fileName
        }
      })),
      actorId
    )

    // -> Every asset under it is served from a different path now, and nothing about the assets
    //    themselves changed for the file cache to notice
    WIKI.models.assets.forgetAllPaths()

    // -> What a sidebar is inherited from is where an entry SITS, and everything under here now sits
    //    somewhere else
    await WIKI.models.navigation.repointMovedSubtree({
      siteId,
      folderId: folder.id,
      locale: destinationLocale,
      folderPath: newParentPath,
      fileName: folder.fileName
    })

    // -> The folder it left holds one fewer entry, and the one it arrived in holds one more
    await this.countTowardsFolderAt(siteId, folder.locale, oldParentPath, -1)
    await this.countTowardsFolderAt(siteId, destinationLocale, newParentPath, 1)

    WIKI.logger.debug(`Moved folder ${folder.id} successfully.`)
    return updated[0] as TreeRow
  }

  /**
   * Rewrite where everything at or below a folder now sits.
   *
   * Two rows carry a path and both have to be redone. The tree's own `hash` is how an entry is found
   * by its path, so leaving it would make every page and asset under the folder unreachable by URL.
   * A page then keeps a second copy of its path on `pages` -- the `path` itself and the `hash` a
   * reader's request is actually resolved through -- so leaving that would move the page in the tree
   * while still serving it from where it used to be, and nothing at all from where it now is.
   *
   * An asset has no path of its own: its tree row is the only thing that places it, and moving that
   * row is the whole job.
   *
   * The two hashes are not the same function and neither exists in postgres, so each row is rewritten
   * from here. What is deliberately not touched is `updatedAt`: the folder moved, the pages under it
   * did not change, and marking a few hundred of them as freshly edited would say otherwise.
   *
   * Scoped to ONE LOCALE, and every caller has to say which. The tree holds every translation side by
   * side under the same paths, so `folderPath <@ 'guides'` is the English subtree and the French one
   * and every other — and a rewrite that took them all in would report another locale's pages as
   * having moved, sending a storage target to move files that never went anywhere.
   *
   * @returns Where each page moved from and to, for the copies a storage target keeps of them. The
   *   old path is only knowable from here — a moment later the row no longer says where it was.
   */
  private async refreshDescendantPaths(
    siteId: string,
    locale: string,
    path: string
  ): Promise<
    { id: string; locale: string; previousPath: string; path: string; contentType: string }[]
  > {
    const rows = await WIKI.db
      .select({
        id: treeTable.id,
        type: treeTable.type,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        locale: treeTable.locale,
        previousPath: pagesTable.path,
        contentType: pagesTable.contentType
      })
      .from(treeTable)
      .leftJoin(pagesTable, eq(pagesTable.id, treeTable.id))
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, locale),
          sql`${treeTable.folderPath} <@ ${path}::ltree`
        )
      )

    const movedPages = []
    for (const row of rows) {
      const folderPath = decodeTreePath(row.folderPath ?? '')
      const fullPath = folderPath ? `${folderPath}/${row.fileName}` : row.fileName
      await WIKI.db
        .update(treeTable)
        .set({ hash: generateHash(fullPath) })
        .where(eq(treeTable.id, row.id))
      if (row.type === 'page') {
        await WIKI.db
          .update(pagesTable)
          .set({ path: fullPath, hash: generatePathHash(fullPath) })
          .where(eq(pagesTable.id, row.id))
        movedPages.push({
          id: row.id,
          locale: row.locale,
          previousPath: row.previousPath ?? fullPath,
          path: fullPath,
          contentType: row.contentType ?? 'markdown'
        })
      }
    }
    if (rows.length > 0) {
      WIKI.logger.debug(
        `Refreshed the path of ${rows.length} moved entrie(s), ${movedPages.length} of them page(s).`
      )
    }
    return movedPages
  }

  /**
   * Delete a folder and everything under it.
   *
   * @returns The deleted pages and assets, for the caller to clean up after. Where each one sat comes
   *          back with it: the tree row is the only record of that, and it is gone by then — but what
   *          was deleted is exactly what a webhook subscriber is owed.
   */
  async deleteFolder(folderId: string): Promise<{ pages: DeletedEntry[]; assets: DeletedEntry[] }> {
    const folder = await this.getFolderById(folderId)
    if (!folder) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    const path = childPathOf(folder)
    WIKI.logger.debug(`Deleting folder ${folder.id} at path ${path}...`)

    /*
      `<@` is "at or below", and the folder itself is not under its own child path, so this takes the
      descendants and leaves the row that owns them.

      Scoped to this folder's locale, as the rename and the move beside it are: the tree holds every
      translation side by side under the same paths, so without it deleting the English `/guides`
      took the French one's pages and files with it and left its folder rows behind, empty.
    */
    const deleted = await WIKI.db
      .delete(treeTable)
      .where(
        and(
          eq(treeTable.siteId, folder.siteId),
          eq(treeTable.locale, folder.locale),
          sql`${treeTable.folderPath} <@ ${path}::ltree`
        )
      )
      .returning({
        id: treeTable.id,
        type: treeTable.type,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName,
        locale: treeTable.locale
      })

    await WIKI.db.delete(treeTable).where(eq(treeTable.id, folder.id))

    // -> Any of them may have owned a sidebar menu keyed by its own id, the folder included
    await WIKI.models.navigation.deleteNavForEntries([...deleted.map((n) => n.id), folder.id])

    await this.countTowardsFolderAt(folder.siteId, folder.locale, folder.folderPath ?? '', -1)

    WIKI.logger.debug(`Deleted folder ${folder.id} and ${deleted.length} descendant(s).`)

    const asEntry = (row: (typeof deleted)[number]): DeletedEntry => ({
      id: row.id,
      folderPath: decodeTreePath(row.folderPath ?? '') ?? '',
      fileName: row.fileName,
      locale: row.locale
    })
    return {
      pages: deleted.filter((n) => n.type === 'page').map(asEntry),
      assets: deleted.filter((n) => n.type === 'asset').map(asEntry)
    }
  }

  /**
   * Add a page entry to the tree.
   *
   * @param parentId UUID of the folder to add it to. Takes precedence over `parentPath`.
   * @param parentPath Slash-separated path of the folder to add it to, created if it does not exist.
   */
  async addPage({
    id,
    parentId,
    parentPath,
    fileName,
    title,
    locale,
    siteId,
    tags = [],
    meta = {}
  }: {
    id?: string
    parentId?: string | null
    parentPath?: string | null
    fileName: string
    title: string
    locale: string
    siteId: string
    tags?: string[]
    meta?: Record<string, any>
  }): Promise<TreeRow> {
    return this.addEntry({
      id,
      type: 'page',
      parentId,
      parentPath,
      fileName,
      title,
      locale,
      siteId,
      tags,
      meta,
      // -> Pages inherit the navigation of the site AND LOCALE they are in until something says
      //    otherwise; the first page written in a locale is what creates that menu
      navigationId: await WIKI.models.navigation.siteNavId(siteId, locale),
      // -> A page's file name is its URL, chosen deliberately by whoever wrote it, so a clash is
      //    something to report rather than something to work around
      onConflict: 'error'
    })
  }

  /**
   * Add an asset entry to the tree.
   *
   * @param parentId UUID of the folder to add it to. Takes precedence over `parentPath`.
   * @param parentPath Slash-separated path of the folder to add it to, created if it does not exist.
   */
  async addAsset({
    id,
    parentId,
    parentPath,
    fileName,
    title,
    locale,
    siteId,
    tags = [],
    meta = {}
  }: {
    id?: string
    parentId?: string | null
    parentPath?: string | null
    fileName: string
    title: string
    locale: string
    siteId: string
    tags?: string[]
    meta?: Record<string, any>
  }): Promise<TreeRow> {
    return this.addEntry({
      id,
      type: 'asset',
      parentId,
      parentPath,
      fileName,
      title,
      locale,
      siteId,
      tags,
      meta,
      // -> Whatever the site's upload conflict behavior is, a name that is taken by the time the row
      //    is written takes the next free `name-1.ext`: the assets model settled the collisions it
      //    could see, and a file that appeared since must not fail on something the uploader did not
      //    choose and cannot see
      onConflict: 'suffix'
    })
  }

  /**
   * Rename a page or asset entry within its folder.
   *
   * @returns The updated row, or null if there is no such entry
   */
  async renameEntry({
    id,
    fileName,
    title
  }: {
    id: string
    fileName: string
    title?: string
  }): Promise<TreeRow | null> {
    const entry = await this.getById(id)
    if (!entry) {
      return null
    }
    if (entry.fileName !== fileName) {
      const existing = await WIKI.db
        .select({ id: treeTable.id })
        .from(treeTable)
        .where(
          and(
            ne(treeTable.id, entry.id),
            eq(treeTable.siteId, entry.siteId),
            eq(treeTable.locale, entry.locale),
            eq(treeTable.folderPath, entry.folderPath ?? ''),
            eq(treeTable.fileName, fileName),
            // -> A page may take the name of the folder holding the pages below it; see `resolveName`
            ...(entry.type === 'page' ? [ne(treeTable.type, 'folder')] : [])
          )
        )
        .limit(1)
      if (existing.length > 0) {
        throw new CustomError(
          'treeEntryDuplicate',
          'Something with this name already exists here.',
          409
        )
      }
    }

    const folderPath = decodeTreePath(entry.folderPath ?? '')
    const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName
    const updated = await WIKI.db
      .update(treeTable)
      .set({
        fileName,
        title: title ?? entry.title,
        hash: generateHash(fullPath),
        updatedAt: sql`now()`
      })
      .where(eq(treeTable.id, entry.id))
      .returning()
    return updated[0] as TreeRow
  }

  /**
   * Remove a page or asset entry from the tree, keeping its folder's count straight.
   */
  async deleteEntry(id: string): Promise<boolean> {
    const entry = await this.getById(id)
    if (!entry) {
      return false
    }
    await WIKI.db.delete(treeTable).where(eq(treeTable.id, id))
    await this.countTowardsFolderAt(entry.siteId, entry.locale, entry.folderPath ?? '', -1)
    return true
  }

  /**
   * Insert a page or asset row, resolving its folder first and counting it against that folder.
   */
  private async addEntry({
    id,
    type,
    parentId,
    parentPath,
    fileName,
    title,
    locale,
    siteId,
    tags,
    meta,
    navigationId,
    onConflict
  }: {
    id?: string
    type: Exclude<TreeItemType, 'folder'>
    parentId?: string | null
    parentPath?: string | null
    fileName: string
    title: string
    locale: string
    siteId: string
    tags: string[]
    meta: Record<string, any>
    navigationId?: string
    onConflict: 'error' | 'suffix'
  }): Promise<TreeRow> {
    const folder =
      parentId || parentPath
        ? await this.getFolder({
            id: parentId,
            path: parentPath,
            locale,
            siteId,
            createIfMissing: true
          })
        : null
    const path = folder ? childPathOf(folder) : ''

    const name = await this.resolveName({ siteId, locale, path, type, fileName, onConflict })
    const fullPath = path ? `${decodeTreePath(path)}/${name}` : name

    WIKI.logger.debug(`Adding ${type} ${fullPath} to tree...`)

    const inserted = await WIKI.db
      .insert(treeTable)
      .values({
        ...(id ? { id } : {}),
        folderPath: path,
        fileName: name,
        type,
        // -> A title that was only ever the file name follows it when the name had to change, so that
        //    two uploads of `photo.png` do not both show up called `photo.png`
        title: title === fileName ? name : title,
        hash: generateHash(fullPath),
        locale,
        siteId,
        tags,
        meta,
        ...(navigationId ? { navigationId } : {})
      })
      .returning()

    await this.countTowardsFolderAt(siteId, locale, path, 1)

    return inserted[0] as TreeRow
  }

  /**
   * Settle on a file name that nothing in the folder is already using.
   *
   * Two entries with the same name in the same folder would share a path, and therefore a hash — the
   * second one would shadow the first everywhere it is looked up by URL. An upload takes the next free
   * `name-1.ext`, the way a file manager is expected to; anything else says so instead.
   *
   * A page is the exception: a page and the folder of the pages below it are *meant* to share a name,
   * which is what `/guide` being both a page and the way into `/guide/…` is. Nothing shadows anything
   * there, because the two are never looked up the same way — a folder is only ever resolved as a
   * folder (`getFolder` asks for the type), and the page is found in `pages` by its own path hash.
   * An asset stays held to the whole folder, since it is served at that URL like a page would be and
   * `assets.upload` refuses the mirror image of this for the same reason.
   */
  private async resolveName({
    siteId,
    locale,
    path,
    type,
    fileName,
    onConflict
  }: {
    siteId: string
    locale: string
    path: string
    type: Exclude<TreeItemType, 'folder'>
    fileName: string
    onConflict: 'error' | 'suffix'
  }): Promise<string> {
    const taken = async (name: string) =>
      (
        await WIKI.db
          .select({ id: treeTable.id })
          .from(treeTable)
          .where(
            and(
              eq(treeTable.siteId, siteId),
              eq(treeTable.locale, locale),
              eq(treeTable.folderPath, path),
              eq(treeTable.fileName, name),
              ...(type === 'page' ? [ne(treeTable.type, 'folder')] : [])
            )
          )
          .limit(1)
      ).length > 0

    if (!(await taken(fileName))) {
      return fileName
    }
    if (onConflict === 'error') {
      throw new CustomError(
        'treeEntryDuplicate',
        'Something with this name already exists here.',
        409
      )
    }

    const dot = fileName.lastIndexOf('.')
    const stem = dot > 0 ? fileName.slice(0, dot) : fileName
    const ext = dot > 0 ? fileName.slice(dot) : ''
    for (let i = 1; i <= MAX_NAME_ATTEMPTS; i++) {
      const candidate = `${stem}-${i}${ext}`
      if (!(await taken(candidate))) {
        return candidate
      }
    }
    throw new CustomError(
      'treeEntryDuplicate',
      'Too many files in this folder are already named this.',
      409
    )
  }

  /**
   * Move the children count of the folder sitting at an ltree path.
   *
   * The count lives on the folder rather than being counted on read, so it has to be kept straight by
   * whoever adds or removes something. The arithmetic is done in postgres rather than read-then-write
   * so that two concurrent uploads into the same folder cannot lose one another's increment.
   *
   * An empty path is the site root, which is not a folder and has nothing to count.
   */
  private async countTowardsFolderAt(
    siteId: string,
    locale: string,
    path: string,
    delta: number
  ): Promise<void> {
    if (!path) {
      return
    }
    const location = splitPath(path)
    await WIKI.db
      .update(treeTable)
      .set({
        meta: sql`jsonb_set(${treeTable.meta}, '{children}', to_jsonb(GREATEST(0, COALESCE((${treeTable.meta}->>'children')::int, 0) + ${delta})))`
      })
      .where(
        and(
          eq(treeTable.siteId, siteId),
          // -> The tree holds every translation side by side, so a path names one folder PER LOCALE:
          //    without this, adding a file to the English `/guides` also counted it against the French
          //    one, and a folder that moved between locales decremented a folder it never sat in
          eq(treeTable.locale, locale),
          eq(treeTable.folderPath, location.folderPath),
          eq(treeTable.fileName, location.fileName),
          eq(treeTable.type, 'folder')
        )
      )
  }
}

export const tree = new Tree()
