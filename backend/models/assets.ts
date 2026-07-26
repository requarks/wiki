import path from 'node:path'
import mime from 'mime'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { assets as assetsTable, tree as treeTable } from '../db/schema.ts'
import { CustomError, decodeTreePath } from '../helpers/common.ts'
import { makeImageThumbnail } from '../helpers/images.ts'

/** How large the file manager renders a preview. Generated once, at upload time. */
const THUMBNAIL_SIZE = { width: 320, height: 200 }

/** What an asset is, for the sake of grouping and filtering. Mirrors the `assetKind` schema enum. */
export type AssetKind = 'document' | 'image' | 'other'

/** Extensions that count as a document rather than "other". */
const DOCUMENT_EXTS = new Set([
  'csv',
  'doc',
  'docx',
  'epub',
  'md',
  'odp',
  'ods',
  'odt',
  'pdf',
  'ppt',
  'pptx',
  'rtf',
  'txt',
  'xls',
  'xlsx'
])

/** An asset's metadata, as exposed by the API. */
export interface Asset {
  id: string
  fileName: string
  fileExt: string
  kind: AssetKind
  mimeType: string
  fileSize: number
  /** Slash-separated, without a leading or trailing slash. Empty at the site root. */
  folderPath: string
  title: string
  hasPreview: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Reduce whatever a client called the file to something safe to store, address and serve.
 *
 * Any directory part is dropped — the folder comes from the request, never from the name — and what
 * is left is lowercased down to the characters that survive a URL untouched, which is the same bar
 * folder path names are held to.
 */
export function sanitizeFileName(input: string): string {
  const base = path.basename(input.trim().replaceAll('\\', '/'))
  const cleaned = base
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^a-z0-9._-]/g, '')
    // -> A leading dot would make it a hidden file, and a run of them can walk out of the folder
    .replace(/^\.+/, '')
    .replaceAll(/\.{2,}/g, '.')
  return cleaned.slice(0, 255)
}

/**
 * The extension, lowercase and without its dot. Empty when the name has none.
 */
function extensionOf(fileName: string): string {
  return path.extname(fileName).replace(/^\./, '').toLowerCase()
}

function kindOf(mimeType: string, fileExt: string): AssetKind {
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/') ||
    DOCUMENT_EXTS.has(fileExt)
  ) {
    return 'document'
  }
  return 'other'
}

/**
 * Assets model
 *
 * An asset is a file a user uploaded: its bytes live in the `assets` table, while its name and place
 * in the site live in the matching `tree` row, which shares its ID. Both are written together — an
 * asset with no tree row would be unreachable, and a tree row with no asset would be a broken link.
 *
 * Storage targets are not implemented yet, so the database is the only copy.
 */
class Assets {
  /**
   * Store an uploaded file.
   *
   * @param folderId UUID of the folder to upload into. The site root when absent.
   * @param fileName What to call it. Sanitized, so what comes back may differ from what went in.
   * @param data The file itself.
   */
  async upload({
    siteId,
    locale,
    folderId,
    fileName,
    mimeType,
    data,
    authorId
  }: {
    siteId: string
    locale: string
    folderId?: string | null
    fileName: string
    mimeType?: string | null
    data: Buffer
    authorId: string
  }): Promise<Asset> {
    const safeName = sanitizeFileName(fileName)
    if (!safeName) {
      throw new CustomError('assetInvalidFileName', 'This file name cannot be used.')
    }
    const fileExt = extensionOf(safeName)
    // -> The extension decides the type, not the request: the declared one is whatever the client felt
    //    like sending, and this value is what gets served back to a browser later
    const resolvedMime = mime.getType(safeName) ?? mimeType ?? 'application/octet-stream'
    const kind = kindOf(resolvedMime, fileExt)

    const preview =
      kind === 'image'
        ? await makeImageThumbnail(data, THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height)
        : null

    // -> The tree row goes in first: it owns the name, and it is what settles a collision with
    //    something already in the folder before any bytes are written. What comes back is the name
    //    that was actually free, which is not always the one asked for.
    const entry = await WIKI.models.tree.addAsset({
      parentId: folderId,
      fileName: safeName,
      title: safeName,
      locale,
      siteId,
      meta: {
        fileSize: data.length,
        fileExt,
        mimeType: resolvedMime
      }
    })
    const storedName = entry.fileName

    try {
      await WIKI.db.insert(assetsTable).values({
        id: entry.id,
        fileName: storedName,
        fileExt,
        kind,
        mimeType: resolvedMime,
        fileSize: data.length,
        data,
        preview,
        authorId,
        siteId
      })
    } catch (err) {
      // -> Nothing points at the tree row now, and leaving it would show a file the site cannot serve
      await WIKI.db.delete(treeTable).where(eq(treeTable.id, entry.id))
      throw err
    }

    WIKI.models.hooks.emit('asset:upload', {
      id: entry.id,
      fileName: storedName,
      folderPath: decodeTreePath(entry.folderPath ?? '') ?? '',
      siteId,
      authorId,
      metadata: { fileSize: data.length, mimeType: resolvedMime, kind }
    })

    return {
      id: entry.id,
      fileName: storedName,
      fileExt,
      kind,
      mimeType: resolvedMime,
      fileSize: data.length,
      folderPath: decodeTreePath(entry.folderPath ?? '') ?? '',
      title: entry.title,
      hasPreview: Boolean(preview),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
  }

  /**
   * An asset's metadata, without its bytes. Null if there is no such asset on this site.
   */
  async getAsset(siteId: string, id: string): Promise<Asset | null> {
    const results = await WIKI.db
      .select({
        id: assetsTable.id,
        fileName: assetsTable.fileName,
        fileExt: assetsTable.fileExt,
        kind: assetsTable.kind,
        mimeType: assetsTable.mimeType,
        fileSize: assetsTable.fileSize,
        createdAt: assetsTable.createdAt,
        updatedAt: assetsTable.updatedAt,
        folderPath: treeTable.folderPath,
        title: treeTable.title,
        // -> Only whether there is one: the preview itself can be megabytes, and no caller of this
        //    wants it inlined
        hasPreview: sql<boolean>`${assetsTable.preview} IS NOT NULL`
      })
      .from(assetsTable)
      .innerJoin(treeTable, eq(treeTable.id, assetsTable.id))
      .where(and(eq(assetsTable.id, id), eq(assetsTable.siteId, siteId)))
      .limit(1)

    const row = results[0]
    if (!row) {
      return null
    }
    return {
      ...row,
      fileSize: row.fileSize ?? 0,
      folderPath: decodeTreePath(row.folderPath ?? '') ?? '',
      hasPreview: Boolean(row.hasPreview)
    } as Asset
  }

  /**
   * An asset's bytes, along with what to serve them as. Null if there is no such asset.
   *
   * Not scoped to a site, unlike the rest: the ID is a UUID nobody can guess, and the routes that use
   * this are the public ones, which have no site of their own to check against.
   */
  async getContent(
    id: string
  ): Promise<{ data: Buffer; mimeType: string; fileName: string } | null> {
    const results = await WIKI.db
      .select({
        data: assetsTable.data,
        mimeType: assetsTable.mimeType,
        fileName: assetsTable.fileName
      })
      .from(assetsTable)
      .where(eq(assetsTable.id, id))
      .limit(1)
    const row = results[0]
    return row?.data ? { data: row.data, mimeType: row.mimeType, fileName: row.fileName } : null
  }

  /**
   * An asset's thumbnail, or null when it has none — which is the normal state for anything that is
   * not an image, and for images uploaded while Sharp was unavailable.
   */
  async getThumbnail(id: string): Promise<Buffer | null> {
    const results = await WIKI.db
      .select({ preview: assetsTable.preview })
      .from(assetsTable)
      .where(eq(assetsTable.id, id))
      .limit(1)
    return results[0]?.preview ?? null
  }

  /**
   * Rename an asset, in both of the rows that describe it.
   *
   * @returns The updated metadata, or null if there is no such asset on this site
   */
  async renameAsset(siteId: string, id: string, fileName: string): Promise<Asset | null> {
    const asset = await this.getAsset(siteId, id)
    if (!asset) {
      return null
    }
    const safeName = sanitizeFileName(fileName)
    if (!safeName) {
      throw new CustomError('assetInvalidFileName', 'This file name cannot be used.')
    }
    const fileExt = extensionOf(safeName)
    if (!fileExt) {
      throw new CustomError('assetInvalidFileName', 'The file name must keep a file extension.')
    }
    const resolvedMime = mime.getType(safeName) ?? asset.mimeType

    await WIKI.models.tree.renameEntry({ id, fileName: safeName, title: safeName })
    await WIKI.db
      .update(assetsTable)
      .set({
        fileName: safeName,
        fileExt,
        mimeType: resolvedMime,
        kind: kindOf(resolvedMime, fileExt),
        updatedAt: sql`now()`
      })
      .where(eq(assetsTable.id, id))
    // -> The tree carries its own copy of these, and it is what a folder listing reads
    await WIKI.db
      .update(treeTable)
      .set({ meta: { fileSize: asset.fileSize, fileExt, mimeType: resolvedMime } })
      .where(eq(treeTable.id, id))

    WIKI.models.hooks.emit('asset:rename', {
      id,
      fileName: safeName,
      previousFileName: asset.fileName,
      folderPath: asset.folderPath,
      siteId
    })

    return this.getAsset(siteId, id)
  }

  /**
   * Delete an asset and the tree entry that points at it.
   *
   * @returns Whether an asset was deleted
   */
  async deleteAsset(siteId: string, id: string): Promise<boolean> {
    const asset = await this.getAsset(siteId, id)
    if (!asset) {
      return false
    }
    await WIKI.db.delete(assetsTable).where(eq(assetsTable.id, id))
    await WIKI.models.tree.deleteEntry(id)

    WIKI.models.hooks.emit('asset:delete', {
      id,
      fileName: asset.fileName,
      folderPath: asset.folderPath,
      siteId
    })

    return true
  }

  /**
   * Delete the assets left behind by a folder deletion, which removed their tree entries already.
   */
  async deleteOrphaned(ids: string[]): Promise<void> {
    if (ids.length < 1) {
      return
    }
    await WIKI.db.delete(assetsTable).where(inArray(assetsTable.id, ids))
  }
}

export const assets = new Assets()
