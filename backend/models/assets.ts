import fs from 'node:fs/promises'
import path from 'node:path'
import mime from 'mime'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { assets as assetsTable, tree as treeTable } from '../db/schema.ts'
import { CustomError, decodeTreePath, encodeTreePath } from '../helpers/common.ts'
import { makeImageThumbnail } from '../helpers/images.ts'
import type { Readable } from 'node:stream'
import type { DeletedEntry } from './tree.ts'

/** How large the file manager renders a preview. Generated once, at upload time. */
const THUMBNAIL_SIZE = { width: 320, height: 200 }

/**
 * How long a path resolution is trusted before it is looked up again.
 *
 * The backstop rather than the mechanism: the mutations that move an asset drop the entries they
 * affect, but only on the instance that ran them, and a second instance has no way to hear about it —
 * so every entry expires on its own as well. Short enough that a rename made elsewhere shows up
 * quickly, long enough that a busy page's images resolve once rather than once per request.
 */
const PATH_CACHE_TTL_MS = 60_000

/** How many path resolutions to hold per instance. Each is one row of metadata, so this is small. */
const PATH_CACHE_MAX = 5000

/** Ceiling for the disk cache when nothing is configured. */
const DEFAULT_CACHE_MAX_SIZE = 512 * 1024 * 1024

/** Sweep once this much of the ceiling has been written since the last one. */
const SWEEP_TRIGGER_RATIO = 0.25

/** How far under the ceiling a sweep trims, so that the next write does not trigger another. */
const SWEEP_TARGET_RATIO = 0.8

/**
 * Extensions a browser may render inline. Everything else is sent as a download.
 *
 * Read by both routes that hand out an asset's bytes — the API's `/content` and the public
 * `/_files/` path — which have to agree on what a browser is allowed to open in place.
 */
export const INLINE_EXTS = new Set(['png', 'apng', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'])

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
 * An asset found by its path, which is the one lookup that has to say which locale it landed on: the
 * URL in a page carries none, and the permission rules may be written against one.
 */
export interface AssetAtPath extends Asset {
  locale: string
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
 * The form a file path is cached under.
 *
 * Matches what the lookup does with it — empty segments dropped, lowercased — so that the spellings
 * of a path that reach the same asset share one cache entry instead of each getting their own.
 */
function normalizePath(filePath: string): string {
  return filePath.split('/').filter(Boolean).join('/').toLowerCase()
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
 * Storage targets are not implemented yet, so the database is the only copy — but not the one that
 * answers a request for a file. Serving goes through two caches, because `/_files/` is hit by every
 * image on every page view and neither half of that lookup needs the database twice:
 *
 * 1. **memory**, holding path → metadata for `PATH_CACHE_TTL_MS`, which is what decides the ETag and
 *    answers the conditional requests a browser sends once its own copy goes stale
 * 2. **disk**, under `<dataPath>/cache/files`, holding the bytes, streamed straight to the response
 *
 * Only the database is permanent; both caches are derived and can be deleted at any point, which is
 * also what makes a cold instance correct rather than empty-handed.
 */
class Assets {
  /** Path resolutions, keyed `siteId:path`. Insertion-ordered, so the oldest entry is evictable. */
  pathCache = new Map<string, { asset: AssetAtPath; cachedAt: number }>()

  /** Bytes written to the disk cache since the last sweep, for `SWEEP_TRIGGER_RATIO`. */
  writtenSinceSweep = 0

  /** Whether a sweep is running, so that a burst of writes queues no more than one. */
  sweeping = false

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
   * An asset's metadata, addressed the way a page's content addresses it: by its path within the
   * site. Null if there is nothing there.
   *
   * The path lives on the tree row rather than on the asset — the two share an ID — so the lookup
   * splits it into the folder and the file the way the tree stores them, the folder as an ltree.
   * Both are lowercased, because that is what an upload stored them as.
   *
   * A path can exist once per locale and the URL carries none, so the site's primary locale wins
   * where more than one has a file there. That is also the only one the file manager uploads into.
   */
  async getAssetByPath(siteId: string, filePath: string): Promise<AssetAtPath | null> {
    const segments = filePath.split('/').filter(Boolean)
    const fileName = segments.pop()?.toLowerCase()
    if (!fileName) {
      return null
    }
    const primaryLocale = WIKI.sites[siteId]?.config?.locales?.primary ?? 'en'

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
        locale: treeTable.locale,
        title: treeTable.title,
        hasPreview: sql<boolean>`${assetsTable.preview} IS NOT NULL`
      })
      .from(assetsTable)
      .innerJoin(treeTable, eq(treeTable.id, assetsTable.id))
      .where(
        and(
          eq(assetsTable.siteId, siteId),
          eq(treeTable.type, 'asset'),
          eq(treeTable.folderPath, encodeTreePath(segments.join('/'))),
          eq(treeTable.fileName, fileName)
        )
      )
      .orderBy(desc(sql`${treeTable.locale} = ${primaryLocale}`))
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
    } as AssetAtPath
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

  // == SERVING CACHE ==================

  /**
   * An asset addressed by path, answered from memory where it can be.
   *
   * What `/_files/` resolves every request through: the metadata decides whether the caller may read
   * the file and what its ETag is, both of which are needed before any bytes are worth fetching.
   */
  async resolveAssetPath(siteId: string, filePath: string): Promise<AssetAtPath | null> {
    const key = `${siteId}:${normalizePath(filePath)}`
    const cached = this.pathCache.get(key)
    if (cached && Date.now() - cached.cachedAt < PATH_CACHE_TTL_MS) {
      return cached.asset
    }

    const asset = await this.getAssetByPath(siteId, filePath)
    if (!asset) {
      // -> A path with nothing at it is not remembered as empty: a file uploaded there has no way to
      //    find the entry and clear it, and it would answer 404 for as long as the entry lived
      this.pathCache.delete(key)
      return null
    }
    if (this.pathCache.size >= PATH_CACHE_MAX) {
      const oldest = this.pathCache.keys().next().value
      if (oldest) {
        this.pathCache.delete(oldest)
      }
    }
    this.pathCache.set(key, { asset, cachedAt: Date.now() })
    return asset
  }

  /**
   * Forget what sits at a path, for a change that moved one asset
   */
  forgetPath(siteId: string, folderPath: string, fileName: string): void {
    this.pathCache.delete(
      `${siteId}:${normalizePath(folderPath ? `${folderPath}/${fileName}` : fileName)}`
    )
  }

  /**
   * Forget every path resolution, for a change that moved assets in bulk — a folder renamed or
   * deleted, where the paths that changed are no longer enumerable from what is left in the tree.
   */
  forgetAllPaths(): void {
    this.pathCache.clear()
  }

  /**
   * An asset's bytes, ready to be sent — from the disk cache, or from the database and into it.
   *
   * @returns A stream when the cache holds the file, the buffer when it had to be read, and null when
   *   there is no such asset, i.e. when a cached path resolution has outlived the row behind it
   */
  async readContent(asset: {
    id: string
    updatedAt: Date
  }): Promise<{ body: Readable | Buffer; size: number } | null> {
    const cached = await this.readContentCache(asset)
    if (cached) {
      return cached
    }

    const content = await this.getContent(asset.id)
    if (!content) {
      return null
    }
    await this.writeContentCache(asset, content.data)
    return { body: content.data, size: content.data.length }
  }

  /**
   * Where an asset's bytes sit in the disk cache.
   *
   * Named for the ID and the modification time together, which is what makes an entry immutable:
   * anything that changes a file changes the name it would be cached under, so a stale entry is never
   * read, only left behind for the sweep. Sharded by the first byte of the ID, to keep a wiki's worth
   * of files out of a single directory.
   */
  contentCachePath(asset: { id: string; updatedAt: Date }): string {
    return path.join(
      this.cachePath,
      asset.id.slice(0, 2),
      `${asset.id}-${asset.updatedAt.getTime()}.bin`
    )
  }

  /**
   * Open an asset's cached bytes.
   *
   * The file is opened before it is streamed rather than as it is streamed, so that a sweep removing
   * it midway through a response cannot truncate what is being sent: the handle keeps the bytes
   * readable until the stream closes it, whatever happens to the directory entry.
   *
   * @returns Null when this instance has not cached the file, which is the normal state of a fresh
   *   container and the state of every entry after a change to the file
   */
  async readContentCache(asset: {
    id: string
    updatedAt: Date
  }): Promise<{ body: Readable; size: number } | null> {
    let handle
    try {
      handle = await fs.open(this.contentCachePath(asset), 'r')
    } catch {
      return null
    }
    try {
      const { size } = await handle.stat()
      return { body: handle.createReadStream({ autoClose: true }), size }
    } catch {
      await handle.close().catch(() => {})
      return null
    }
  }

  /**
   * Write an asset's bytes to the disk cache, best effort.
   *
   * A full or read-only disk must not stop a file from being served, hence the swallowed error — the
   * database answers every request the cache cannot. The file is written under a temporary name and
   * renamed, so a concurrent reader sees either nothing or the whole thing.
   */
  async writeContentCache(asset: { id: string; updatedAt: Date }, data: Buffer): Promise<void> {
    // -> A file larger than the whole cache would be evicted by the sweep it triggers
    if (this.cacheMaxSize < 1 || data.length > this.cacheMaxSize) {
      return
    }
    const filePath = this.contentCachePath(asset)
    const tempPath = `${filePath}.${process.pid}.tmp`
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(tempPath, data)
      await fs.rename(tempPath, filePath)
    } catch (err: any) {
      WIKI.logger.warn(`Could not write ${filePath} to the file cache [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
      await fs.rm(tempPath, { force: true }).catch(() => {})
      return
    }

    this.writtenSinceSweep += data.length
    if (this.writtenSinceSweep >= this.cacheMaxSize * SWEEP_TRIGGER_RATIO) {
      // -> Nothing waits on this: the request that filled the cache is not the one that should pay
      //    for measuring it
      void this.sweepCache()
    }
  }

  /**
   * Drop whatever the disk cache holds for these assets.
   *
   * Every entry an asset has, not just its current one — a file renamed twice leaves two behind, and
   * the point of this is to reclaim the space rather than to correct an answer, which the naming
   * already does.
   */
  async dropCachedContent(ids: string[]): Promise<void> {
    for (const id of ids) {
      const shard = path.join(this.cachePath, id.slice(0, 2))
      try {
        const entries = await fs.readdir(shard)
        await Promise.all(
          entries
            .filter((name) => name.startsWith(`${id}-`))
            .map((name) => fs.rm(path.join(shard, name), { force: true }))
        )
      } catch {
        // -> Nothing cached for it on this instance, which is not worth reporting
      }
    }
  }

  /**
   * Trim the disk cache back under its ceiling, oldest entry first.
   *
   * Oldest by when it was written rather than when it was last read: keeping a true LRU would mean
   * touching a file on every hit, which puts a write back on the path this cache exists to keep
   * writes off. An entry evicted while still in demand is refilled by the next request for it.
   */
  async sweepCache(): Promise<void> {
    if (this.sweeping) {
      return
    }
    this.sweeping = true
    this.writtenSinceSweep = 0
    try {
      const files: { path: string; size: number; writtenAt: number }[] = []
      let total = 0
      const entries = await fs.readdir(this.cachePath, { recursive: true, withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.bin')) {
          continue
        }
        const filePath = path.join(entry.parentPath, entry.name)
        const stat = await fs.stat(filePath).catch(() => null)
        if (!stat) {
          continue
        }
        files.push({ path: filePath, size: stat.size, writtenAt: stat.mtimeMs })
        total += stat.size
      }
      if (total <= this.cacheMaxSize) {
        return
      }

      files.sort((a, b) => a.writtenAt - b.writtenAt)
      const target = this.cacheMaxSize * SWEEP_TARGET_RATIO
      let removed = 0
      for (const file of files) {
        if (total <= target) {
          break
        }
        await fs.rm(file.path, { force: true })
        total -= file.size
        removed++
      }
      WIKI.logger.debug(`Trimmed ${removed} file(s) from the file cache [ OK ]`)
    } catch (err: any) {
      WIKI.logger.warn('Could not sweep the file cache [ SKIPPED ]')
      WIKI.logger.warn(err.message)
    } finally {
      this.sweeping = false
    }
  }

  /** Where the disk cache lives. Derived data — deleting it costs a refill and nothing else. */
  get cachePath(): string {
    return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache/files')
  }

  /** How large the disk cache may grow, in bytes. Zero turns it off. */
  get cacheMaxSize(): number {
    return WIKI.config.files?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE
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

    // -> Both ends of the move: the name it left, and the name it took, which something else may have
    //    been resolved at before it was freed up
    this.forgetPath(siteId, asset.folderPath, asset.fileName)
    this.forgetPath(siteId, asset.folderPath, safeName)
    await this.dropCachedContent([id])

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

    this.forgetPath(siteId, asset.folderPath, asset.fileName)
    await this.dropCachedContent([id])

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
  async deleteOrphaned(siteId: string, entries: DeletedEntry[]): Promise<void> {
    if (entries.length < 1) {
      return
    }
    const ids = entries.map((entry) => entry.id)
    await WIKI.db.delete(assetsTable).where(inArray(assetsTable.id, ids))

    // -> Which paths they sat at is no longer knowable from the tree: those rows went with the folder
    this.forgetAllPaths()
    await this.dropCachedContent(ids)

    // -> One per file, as deleting them one at a time would have sent: a subscriber mirroring the
    //    wiki has to hear about each file, not about the folder it happened to sit in
    for (const entry of entries) {
      await WIKI.models.hooks.emit('asset:delete', {
        id: entry.id,
        fileName: entry.fileName,
        folderPath: entry.folderPath,
        siteId
      })
    }
  }
}

export const assets = new Assets()
