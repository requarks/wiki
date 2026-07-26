import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import { tree as treeTable } from '../db/schema.ts'
import { CustomError, decodeTreePath, encodeTreePath, generateHash } from '../helpers/common.ts'

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
  /** Folders only — whether this folder is a parent of the one being listed, not a child of it. */
  isAncestor?: boolean
  /** Assets only. */
  fileSize?: number
  fileExt?: string
  mimeType?: string
  /** Pages only. */
  editor?: string
  description?: string
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
      // -> Shorter than the folder being listed means it sits above it, so it came from
      //    `includeAncestors` / `includeRootFolders` rather than from the listing itself
      isAncestor: folderPath.length < parentPath.length
    }),
    ...(row.type === 'asset' && {
      fileSize: row.meta?.fileSize ?? 0,
      fileExt: row.meta?.fileExt ?? '',
      mimeType: row.meta?.mimeType ?? ''
    }),
    ...(row.type === 'page' && {
      editor: row.meta?.editor ?? '',
      description: row.meta?.description ?? ''
    })
  }
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
      conditions.push(sql`${treeTable.tags} @> ${tags}`)
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
   * @param pathName The folder's own path segment, lowercase and URL friendly.
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
    if (!rePathName.test(pathName)) {
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

    const existing = await WIKI.db
      .select({ id: treeTable.id })
      .from(treeTable)
      .where(
        and(
          eq(treeTable.siteId, siteId),
          eq(treeTable.locale, effectiveLocale),
          eq(treeTable.folderPath, path),
          eq(treeTable.fileName, pathName),
          eq(treeTable.type, 'folder')
        )
      )
      .limit(1)
    if (existing.length > 0) {
      throw new CustomError(
        'treeFolderDuplicate',
        'A folder with this path name already exists.',
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
              ...expected.map(
                (ancestor) =>
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
        await this.countTowardsFolderAt(siteId, ancestor.folderPath, 1)
      }
    }

    const fullPath = path ? `${decodeTreePath(path)}/${pathName}` : pathName
    const inserted = await WIKI.db
      .insert(treeTable)
      .values({
        folderPath: path,
        fileName: pathName,
        type: 'folder',
        title,
        hash: generateHash(fullPath),
        locale: effectiveLocale,
        siteId,
        meta: { children: 0 }
      })
      .returning()

    await this.countTowardsFolderAt(siteId, path, 1)

    WIKI.logger.debug(`Created folder ${inserted[0].id} successfully.`)
    return inserted[0] as TreeRow
  }

  /**
   * Rename a folder, moving everything under it along with it.
   *
   * @param pathName The new path segment. Unchanged from the current one when only the title differs,
   *                 which leaves every descendant's path untouched.
   */
  async renameFolder({
    folderId,
    pathName,
    title
  }: {
    folderId: string
    pathName: string
    title: string
  }): Promise<TreeRow> {
    const folder = await this.getFolderById(folderId)
    if (!folder) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    if (!rePathName.test(pathName)) {
      throw new CustomError(
        'treeInvalidPath',
        'A folder path name may only contain lowercase alphanumeric and hyphen characters.'
      )
    }
    if (!reTitle.test(title)) {
      throw new CustomError('treeInvalidTitle', 'The folder title contains invalid characters.')
    }

    if (pathName === folder.fileName) {
      const updated = await WIKI.db
        .update(treeTable)
        .set({ title, updatedAt: sql`now()` })
        .where(eq(treeTable.id, folder.id))
        .returning()
      return updated[0] as TreeRow
    }

    const existing = await WIKI.db
      .select({ id: treeTable.id })
      .from(treeTable)
      .where(
        and(
          ne(treeTable.id, folder.id),
          eq(treeTable.siteId, folder.siteId),
          eq(treeTable.locale, folder.locale),
          eq(treeTable.folderPath, folder.folderPath ?? ''),
          eq(treeTable.fileName, pathName),
          eq(treeTable.type, 'folder')
        )
      )
      .limit(1)
    if (existing.length > 0) {
      throw new CustomError(
        'treeFolderDuplicate',
        'A folder with this path name already exists.',
        409
      )
    }

    const oldPath = childPathOf(folder)
    const newPath = folder.folderPath ? `${folder.folderPath}.${pathName}` : pathName

    WIKI.logger.debug(`Renaming folder ${folder.id} from ${oldPath} to ${newPath}...`)

    // -> Direct children carry the old path verbatim; deeper ones carry it as a prefix, and keep
    //    whatever they had below it
    await WIKI.db
      .update(treeTable)
      .set({ folderPath: newPath })
      .where(and(eq(treeTable.siteId, folder.siteId), eq(treeTable.folderPath, oldPath)))
    await WIKI.db
      .update(treeTable)
      .set({
        folderPath: sql`${newPath}::ltree || subpath(${treeTable.folderPath}, nlevel(${newPath}::ltree))`
      })
      .where(
        and(eq(treeTable.siteId, folder.siteId), sql`${treeTable.folderPath} <@ ${oldPath}::ltree`)
      )

    const fullPath = folder.folderPath
      ? `${decodeTreePath(folder.folderPath)}/${pathName}`
      : pathName
    const updated = await WIKI.db
      .update(treeTable)
      .set({ fileName: pathName, title, hash: generateHash(fullPath), updatedAt: sql`now()` })
      .where(eq(treeTable.id, folder.id))
      .returning()

    await this.refreshHashes(folder.siteId, newPath)

    WIKI.logger.debug(`Renamed folder ${folder.id} successfully.`)
    return updated[0] as TreeRow
  }

  /**
   * Recompute the path hash of everything at or below a folder.
   *
   * The hash is how an entry is found by its path, so moving a branch without redoing them would
   * leave every page and asset under it unreachable by URL. It is a SHA-1 of the full path, which
   * postgres has no function for, so each row is rewritten from here.
   */
  private async refreshHashes(siteId: string, path: string): Promise<void> {
    const rows = await WIKI.db
      .select({
        id: treeTable.id,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName
      })
      .from(treeTable)
      .where(and(eq(treeTable.siteId, siteId), sql`${treeTable.folderPath} <@ ${path}::ltree`))

    for (const row of rows) {
      const folderPath = decodeTreePath(row.folderPath ?? '')
      const fullPath = folderPath ? `${folderPath}/${row.fileName}` : row.fileName
      await WIKI.db
        .update(treeTable)
        .set({ hash: generateHash(fullPath) })
        .where(eq(treeTable.id, row.id))
    }
    if (rows.length > 0) {
      WIKI.logger.debug(`Refreshed the path hash of ${rows.length} moved entrie(s).`)
    }
  }

  /**
   * Delete a folder and everything under it.
   *
   * @returns The IDs of the deleted pages and assets, for the caller to clean up after
   */
  async deleteFolder(folderId: string): Promise<{ pages: string[]; assets: string[] }> {
    const folder = await this.getFolderById(folderId)
    if (!folder) {
      throw new CustomError('treeInvalidFolder', 'This folder does not exist.', 404)
    }
    const path = childPathOf(folder)
    WIKI.logger.debug(`Deleting folder ${folder.id} at path ${path}...`)

    // -> `<@` is "at or below", and the folder itself is not under its own child path, so this takes
    //    the descendants and leaves the row that owns them
    const deleted = await WIKI.db
      .delete(treeTable)
      .where(
        and(eq(treeTable.siteId, folder.siteId), sql`${treeTable.folderPath} <@ ${path}::ltree`)
      )
      .returning({ id: treeTable.id, type: treeTable.type })

    await WIKI.db.delete(treeTable).where(eq(treeTable.id, folder.id))

    // -> Any of them may have owned a sidebar menu keyed by its own id, the folder included
    await WIKI.models.navigation.deleteNavForEntries([...deleted.map((n) => n.id), folder.id])

    await this.countTowardsFolderAt(folder.siteId, folder.folderPath ?? '', -1)

    WIKI.logger.debug(`Deleted folder ${folder.id} and ${deleted.length} descendant(s).`)

    return {
      pages: deleted.filter((n) => n.type === 'page').map((n) => n.id),
      assets: deleted.filter((n) => n.type === 'asset').map((n) => n.id)
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
      // -> Pages inherit the site's navigation until something says otherwise
      navigationId: siteId,
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
      // -> Uploading a file already in the folder takes the next free `name-1.ext`, rather than
      //    failing on something the uploader did not choose and cannot see
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
            eq(treeTable.fileName, fileName)
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
    await this.countTowardsFolderAt(entry.siteId, entry.folderPath ?? '', -1)
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

    const name = await this.resolveName({ siteId, locale, path, fileName, onConflict })
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

    await this.countTowardsFolderAt(siteId, path, 1)

    return inserted[0] as TreeRow
  }

  /**
   * Settle on a file name that nothing in the folder is already using.
   *
   * Two entries with the same name in the same folder would share a path, and therefore a hash — the
   * second one would shadow the first everywhere it is looked up by URL. An upload takes the next free
   * `name-1.ext`, the way a file manager is expected to; anything else says so instead.
   */
  private async resolveName({
    siteId,
    locale,
    path,
    fileName,
    onConflict
  }: {
    siteId: string
    locale: string
    path: string
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
              eq(treeTable.fileName, name)
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
  private async countTowardsFolderAt(siteId: string, path: string, delta: number): Promise<void> {
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
          eq(treeTable.folderPath, location.folderPath),
          eq(treeTable.fileName, location.fileName),
          eq(treeTable.type, 'folder')
        )
      )
  }
}

export const tree = new Tree()
