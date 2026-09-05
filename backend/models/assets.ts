import fs from 'node:fs/promises'
import path from 'node:path'
import mime from 'mime'
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { assets as assetsTable, tree as treeTable } from '../db/schema.ts'
import {
  CustomError,
  decodeTreePath,
  encodeTreePath,
  normalizeFolderPath
} from '../helpers/common.ts'
import { makeImageThumbnail, readImageDimensions } from '../helpers/images.ts'
import type { ImageDimensions } from '../helpers/images.ts'
import type { Readable } from 'node:stream'
import type { DeletedEntry } from './tree.ts'
import type { StorageAssetRef } from './storage.ts'

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

/**
 * What an upload does about a file already sitting at the name it wants, per the site's
 * `uploads.conflictBehavior` setting.
 *
 * - `overwrite` replaces the file where it is: same ID, same path, so every page pointing at it now
 *   shows the new contents. This is the default, and the one that makes re-uploading a corrected file
 *   do what the uploader meant.
 * - `reject` refuses the upload and says what is in the way, for a wiki where a file's contents are
 *   expected to be stable once published.
 * - `new` keeps both, the arrival taking the next free `name-1.ext`.
 *
 * Whichever is chosen, only an *asset* can be replaced: a page or a folder already holding the name
 * is reported rather than written over.
 */
export type UploadConflictBehavior = 'overwrite' | 'reject' | 'new'

const UPLOAD_CONFLICT_BEHAVIORS = new Set<UploadConflictBehavior>(['overwrite', 'reject', 'new'])

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
  /**
   * Which locale's tree it sits in.
   *
   * Part of where the file *is*, so anything addressing the stored copy needs it — a storage target
   * brackets its tree by locale unless the site says otherwise.
   */
  locale: string
  title: string
  hasPreview: boolean
  /**
   * How big the image is, in pixels. Absent for anything that is not an image, and for an image whose
   * dimensions could not be read when it arrived — Sharp does the reading, and it is an optional
   * dependency, so a file uploaded while it was missing has none and never will.
   */
  width?: number
  height?: number
  createdAt: Date
  updatedAt: Date
}

/**
 * An asset found by its path, rather than by its ID.
 */
export interface AssetAtPath extends Asset {}

/**
 * Reduce whatever a client called the file to something safe to store, address and serve.
 *
 * Any directory part is dropped — the folder comes from the request, never from the name — and what
 * is left is lowercased down to the characters that survive a URL untouched, which is the same bar
 * folder path names are held to.
 *
 * Applied to every upload, with nothing to turn it off: a stored name is a URL, and a path is looked
 * up lowercased, so a name that skipped this would be one the site could not serve back.
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

/**
 * What the dimensions contribute to a stored `meta` object, on the asset row and on the tree row
 * alike.
 *
 * Spread rather than assigned, so that a file with no dimensions to record carries no keys for them
 * rather than a pair of nulls: an absent key is the honest shape for "never measured", and it is what
 * keeps a listing from claiming a document is zero pixels across.
 */
function dimensionMeta(dimensions: ImageDimensions | null): Record<string, number> {
  return dimensions ? { width: dimensions.width, height: dimensions.height } : {}
}

/** The pair back out of anything carrying it, or null when only one of the two is there to read. */
function dimensionsOf(source: {
  width?: number | null
  height?: number | null
}): ImageDimensions | null {
  return source.width && source.height ? { width: source.width, height: source.height } : null
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
 * An asset is a file a user uploaded: its name and its place in the site live in the `tree` row, its
 * metadata in the matching `assets` row, which shares its ID. Both are written together — an asset
 * with no tree row would be unreachable, and a tree row with no asset would be a broken link.
 *
 * Where the *bytes* live is a third thing, and not necessarily the database: they go to whichever
 * storage target the site has configured for a file of that kind and size, and the row records which
 * one took them in `storageInfo`. Nothing here knows what that means for a given target — writing,
 * reading, moving and deleting all go through `WIKI.models.storage`, and the database is simply the
 * target every site starts with. What never leaves this model is the metadata: renaming a file is a
 * database write plus a request to the target to follow it.
 *
 * Serving goes through two caches, because `/_files/` is hit by every image on every page view and
 * neither half of that lookup needs to reach the target twice:
 *
 * 1. **memory**, holding path → metadata for `PATH_CACHE_TTL_MS`, which is what decides the ETag and
 *    answers the conditional requests a browser sends once its own copy goes stale
 * 2. **disk**, under `<dataPath>/cache/files`, holding the bytes, streamed straight to the response
 *
 * Neither cache is storage: both are derived and can be deleted at any point, which is also what
 * makes a cold instance correct rather than empty-handed. The one under `<dataPath>/cache/files` is
 * not to be confused with the local file system storage target, which is a place content actually
 * lives and is never swept.
 */
class Assets {
  /** Path resolutions, keyed `siteId:path`. Insertion-ordered, so the oldest entry is evictable. */
  pathCache = new Map<string, { asset: AssetAtPath; cachedAt: number }>()

  /** Bytes written to the disk cache since the last sweep, for `SWEEP_TRIGGER_RATIO`. */
  writtenSinceSweep = 0

  /** Whether a sweep is running, so that a burst of writes queues no more than one. */
  sweeping = false

  /**
   * What this site does about an upload landing on a name that is taken.
   *
   * Read per upload rather than held anywhere, so that changing it in the admin area applies to the
   * next file rather than to the next restart. Anything unrecognized is treated as the default.
   */
  conflictBehaviorFor(siteId: string): UploadConflictBehavior {
    const configured = WIKI.sites[siteId]?.config?.uploads?.conflictBehavior
    return UPLOAD_CONFLICT_BEHAVIORS.has(configured) ? configured : 'overwrite'
  }

  /**
   * Refuse an upload that is really a page, or that would land on one.
   *
   * A page and an asset occupy the same folder and are stored as the same kind of file, so the two
   * name spaces are one. Nothing in the tree sees that — a page is `readme` and the file is
   * `readme.md`, two different names — so it is enforced here, on the way in, and by
   * `guardAgainstAssetCollision` coming the other way.
   *
   * Two rules, in the order an administrator would expect them:
   *
   * 1. **The site's `pageExtensions` are reserved.** They are the extensions that address a page by
   *    URL, so a file with one of them is a page, and uploading it as an attachment is a mistake
   *    rather than a collision — refused whether or not a page happens to be there today. This is
   *    what keeps `.md` out of the file manager on a default site.
   * 2. **Otherwise, no landing on a page that is there.** For an extension a site has taken off that
   *    list, the two can legitimately coexist right up until one would overwrite the other's file.
   *
   * @throws `assetIsPageExtension` or `assetNameTakenByPage`
   */
  private async guardAgainstPageCollision({
    siteId,
    locale,
    folderId,
    folderPath,
    fileName,
    fileExt
  }: {
    siteId: string
    locale: string
    folderId?: string | null
    folderPath?: string | null
    fileName: string
    fileExt: string
  }): Promise<void> {
    const reserved: string[] = WIKI.sites[siteId]?.config?.pageExtensions ?? []
    if (fileExt && reserved.includes(fileExt)) {
      throw new CustomError(
        'assetIsPageExtension',
        `.${fileExt} is a page extension on this site, so a file with it cannot be uploaded as an attachment. Create a page instead, or remove ${fileExt} from the site's page extensions.`,
        409
      )
    }

    // -> The page this would be the file of, if there is one: same folder, same name without the
    //    extension. Its own extension has to match too — `readme.pdf` is not the file of the
    //    markdown page `readme`, and sits happily beside it.
    const stem = fileName.slice(0, fileName.length - (fileExt ? fileExt.length + 1 : 0))
    if (!stem) {
      return
    }
    const occupant = await WIKI.models.tree.getEntryAt({
      siteId,
      locale,
      parentId: folderId,
      parentPath: folderPath,
      fileName: stem
    })
    if (
      occupant?.type === 'page' &&
      (await WIKI.models.pages.storageFileNameOf(occupant.id)) === fileName
    ) {
      throw new CustomError(
        'assetNameTakenByPage',
        `The page "${stem}" is stored as ${fileName} here, so a file cannot be uploaded under that name.`,
        409
      )
    }
  }

  /**
   * Store an uploaded file.
   *
   * A file already at this name is settled per the site's conflict behavior — see
   * `UploadConflictBehavior`. An overwrite returns the existing asset's ID, so a caller that means to
   * link to what it just uploaded must read the returned name and ID rather than assume its own.
   *
   * @param folderId UUID of the folder to upload into. Takes precedence over `folderPath`.
   * @param folderPath Slash-separated path of the folder to upload into, created if it does not exist.
   *                   The site root when both are absent. A caller that knows a path and not an ID --
   *                   the editor uploading what was pasted into a page, which knows the page it is in
   *                   -- addresses the folder this way rather than looking it up first.
   * @param fileName What to call it. Sanitized, so what comes back may differ from what went in.
   * @param data The file itself.
   */
  async upload({
    siteId,
    locale,
    folderId,
    folderPath,
    fileName,
    mimeType,
    data,
    authorId
  }: {
    siteId: string
    locale: string
    folderId?: string | null
    folderPath?: string | null
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
    await this.guardAgainstPageCollision({
      siteId,
      locale,
      folderId,
      folderPath,
      fileName: safeName,
      fileExt
    })
    // -> The extension decides the type, not the request: the declared one is whatever the client felt
    //    like sending, and this value is what gets served back to a browser later
    const resolvedMime = mime.getType(safeName) ?? mimeType ?? 'application/octet-stream'
    const kind = kindOf(resolvedMime, fileExt)

    const preview =
      kind === 'image'
        ? await makeImageThumbnail(data, THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height)
        : null
    // -> Read now, while the bytes are in hand: a folder listing describes a screenful of files at a
    //    time, and could not open each of them to say how big its image is
    const dimensions = kind === 'image' ? await readImageDimensions(data) : null

    // -> What is already at this name, if anything, and what the site says to do about it. Asked
    //    before any row is touched, since two of the three answers write nothing new at all.
    const behavior = this.conflictBehaviorFor(siteId)
    const occupant =
      behavior === 'new'
        ? null
        : await WIKI.models.tree.getEntryAt({
            siteId,
            locale,
            parentId: folderId,
            parentPath: folderPath,
            fileName: safeName
          })
    if (occupant) {
      if (occupant.type !== 'asset') {
        // -> Neither replacing nor renaming is what an administrator asked for here: a page or a
        //    folder owns this name, and only its owner can give it up
        throw new CustomError(
          'assetNameTakenByEntry',
          `A ${occupant.type} with this name already exists here.`,
          409
        )
      }
      if (behavior === 'reject') {
        throw new CustomError(
          'assetAlreadyExists',
          'A file with this name already exists here.',
          409
        )
      }
      return this.replace({
        id: occupant.id,
        siteId,
        locale,
        folderPath: decodeTreePath(occupant.folderPath ?? '') ?? '',
        fileName: occupant.fileName,
        title: occupant.title,
        fileExt,
        kind,
        mimeType: resolvedMime,
        data,
        preview,
        dimensions,
        authorId
      })
    }

    // -> The tree row goes in first: it owns the name, and it is what settles a collision with
    //    something already in the folder before any bytes are written. What comes back is the name
    //    that was actually free, which is not always the one asked for.
    const entry = await WIKI.models.tree.addAsset({
      parentId: folderId,
      parentPath: folderPath,
      fileName: safeName,
      title: safeName,
      locale,
      siteId,
      meta: {
        fileSize: data.length,
        fileExt,
        mimeType: resolvedMime,
        ...dimensionMeta(dimensions)
      }
    })
    const storedName = entry.fileName
    // -> Read off the row rather than from the request: the folder may have just been created, and a
    //    name that was taken took the next free one
    const storedFolderPath = decodeTreePath(entry.folderPath ?? '') ?? ''

    try {
      // -> The metadata row goes in before the bytes, since the database target writes them into it
      await WIKI.db.insert(assetsTable).values({
        id: entry.id,
        fileName: storedName,
        fileExt,
        kind,
        mimeType: resolvedMime,
        fileSize: data.length,
        meta: dimensionMeta(dimensions),
        preview,
        authorId,
        siteId
      })
      await WIKI.models.storage.putAsset(
        {
          id: entry.id,
          siteId,
          actorId: authorId,
          locale,
          folderPath: storedFolderPath,
          fileName: storedName,
          kind,
          fileSize: data.length
        },
        data
      )
    } catch (err) {
      // -> Nothing points at these now, and leaving them would show a file the site cannot serve
      await WIKI.db.delete(assetsTable).where(eq(assetsTable.id, entry.id))
      await WIKI.db.delete(treeTable).where(eq(treeTable.id, entry.id))
      throw err
    }

    WIKI.models.hooks.emit('asset:upload', {
      id: entry.id,
      fileName: storedName,
      folderPath: storedFolderPath,
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
      folderPath: storedFolderPath,
      locale,
      title: entry.title,
      hasPreview: Boolean(preview),
      ...dimensionMeta(dimensions),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
  }

  /**
   * Replace an existing asset's contents in place, for an upload that landed on it under the
   * `overwrite` conflict behavior.
   *
   * The asset keeps its ID, its name and its place in the tree, so every page and every link already
   * pointing at the file goes on working and now resolves to the new bytes. What changes is what the
   * file *is* — its contents, size, type and thumbnail — plus who put them there.
   *
   * The name it keeps is the stored one, which is why the extension and type are the incoming file's:
   * the two only differ when a browser sent `Photo.PNG` for what is stored as `photo.png`, and the
   * sanitized name is what both agree on.
   *
   * Which targets hold it are worked out again from the incoming file rather than inherited, since
   * the two may not be the same size — replacing a thumbnail with a 40 MB one is how a file crosses
   * the large-file threshold and starts being stored somewhere else entirely.
   */
  private async replace({
    id,
    siteId,
    locale,
    folderPath,
    fileName,
    title,
    fileExt,
    kind,
    mimeType,
    data,
    preview,
    dimensions,
    authorId
  }: {
    id: string
    siteId: string
    locale: string
    folderPath: string
    fileName: string
    title: string
    fileExt: string
    kind: AssetKind
    mimeType: string
    data: Buffer
    preview: Buffer | null
    dimensions: ImageDimensions | null
    authorId: string
  }): Promise<Asset> {
    await WIKI.models.storage.putAsset(
      { id, siteId, actorId: authorId, locale, folderPath, fileName, kind, fileSize: data.length },
      data
    )
    await WIKI.db
      .update(assetsTable)
      .set({
        fileExt,
        kind,
        mimeType,
        fileSize: data.length,
        // -> Set outright rather than merged, since these describe the bytes that just arrived: a
        //    replacement of another size overwrites the old measurements, and one that could not be
        //    measured at all leaves none behind
        meta: dimensionMeta(dimensions),
        preview,
        authorId,
        updatedAt: sql`now()`
      })
      .where(eq(assetsTable.id, id))
    // -> The tree carries its own copy of these, and it is what a folder listing reads
    await WIKI.db
      .update(treeTable)
      .set({
        meta: { fileSize: data.length, fileExt, mimeType, ...dimensionMeta(dimensions) },
        updatedAt: sql`now()`
      })
      .where(eq(treeTable.id, id))

    // -> The path resolves to the same asset as before, but to different metadata: the ETag is the
    //    modification time, so a reader holding the old file has to be told to fetch it again. The
    //    cached bytes are keyed by that same time and are unreachable from here on, but are dropped
    //    rather than left for the sweep, since the file they hold is gone for good.
    this.forgetPath(siteId, folderPath, fileName)
    await this.dropCachedContent([id])

    WIKI.models.hooks.emit('asset:edit', {
      id,
      fileName,
      folderPath,
      siteId,
      authorId,
      metadata: { fileSize: data.length, mimeType, kind }
    })

    const updated = await this.getAsset(siteId, id)
    // -> Only if the row vanished between the update and the read, which means someone deleted the
    //    file mid-upload. Answering with what was written beats failing a request that did land.
    return (
      updated ?? {
        id,
        fileName,
        fileExt,
        kind,
        mimeType,
        fileSize: data.length,
        folderPath,
        locale,
        title,
        hasPreview: Boolean(preview),
        ...dimensionMeta(dimensions),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    )
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
        meta: assetsTable.meta,
        createdAt: assetsTable.createdAt,
        updatedAt: assetsTable.updatedAt,
        folderPath: treeTable.folderPath,
        locale: treeTable.locale,
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
    // -> `meta` is where the row keeps the dimensions and is not itself part of an asset as the API
    //    describes one, so it is unpacked here rather than passed along
    const { meta, ...rest } = row
    return {
      ...rest,
      fileSize: row.fileSize ?? 0,
      folderPath: decodeTreePath(row.folderPath ?? '') ?? '',
      hasPreview: Boolean(row.hasPreview),
      ...dimensionMeta(dimensionsOf(meta as Record<string, any>))
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
        meta: assetsTable.meta,
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
    // -> `meta` is where the row keeps the dimensions and is not itself part of an asset as the API
    //    describes one, so it is unpacked here rather than passed along
    const { meta, ...rest } = row
    return {
      ...rest,
      fileSize: row.fileSize ?? 0,
      folderPath: decodeTreePath(row.folderPath ?? '') ?? '',
      hasPreview: Boolean(row.hasPreview),
      ...dimensionMeta(dimensionsOf(meta as Record<string, any>))
    } as AssetAtPath
  }

  /**
   * An asset's bytes, along with what to serve them as. Null if there is no such asset.
   *
   * Not scoped to a site, unlike the rest: the ID is a UUID nobody can guess, and the routes that use
   * this are the public ones, which have no site of their own to check against. Where the file sits
   * is read off the tree, since that — not a record of where it was put — is how every target
   * addresses its copy.
   */
  async getContent(
    id: string
  ): Promise<{ data: Buffer; mimeType: string; fileName: string } | null> {
    const results = await WIKI.db
      .select({
        id: assetsTable.id,
        siteId: assetsTable.siteId,
        kind: assetsTable.kind,
        fileSize: assetsTable.fileSize,
        mimeType: assetsTable.mimeType,
        fileName: assetsTable.fileName,
        locale: treeTable.locale,
        folderPath: treeTable.folderPath
      })
      .from(assetsTable)
      .innerJoin(treeTable, eq(treeTable.id, assetsTable.id))
      .where(eq(assetsTable.id, id))
      .limit(1)
    const row = results[0]
    if (!row) {
      return null
    }
    const data = await WIKI.models.storage.getAsset({
      id: row.id,
      siteId: row.siteId,
      locale: row.locale,
      folderPath: decodeTreePath(row.folderPath ?? '') ?? '',
      fileName: row.fileName,
      kind: row.kind,
      fileSize: row.fileSize ?? 0
    })
    return data ? { data, mimeType: row.mimeType, fileName: row.fileName } : null
  }

  // == STORAGE ========================

  /**
   * Where each of these assets sits, as a storage target addresses one.
   */
  async getStorageRefs(
    siteId: string,
    ids: string[],
    actorId?: string
  ): Promise<StorageAssetRef[]> {
    if (ids.length < 1) {
      return []
    }
    const rows = await WIKI.db
      .select({
        id: assetsTable.id,
        kind: assetsTable.kind,
        fileSize: assetsTable.fileSize,
        locale: treeTable.locale,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName
      })
      .from(assetsTable)
      .innerJoin(treeTable, eq(treeTable.id, assetsTable.id))
      .where(and(eq(assetsTable.siteId, siteId), inArray(assetsTable.id, ids)))

    return rows.map((row) => ({
      id: row.id,
      siteId,
      actorId,
      locale: row.locale,
      folderPath: decodeTreePath(row.folderPath ?? '') ?? '',
      fileName: row.fileName,
      kind: row.kind,
      fileSize: row.fileSize ?? 0
    }))
  }

  /**
   * Every asset of a site, addressed the way a storage target addresses one.
   *
   * What a target's export action walks in order to find the files it should be holding and is not.
   * Metadata only — the bytes of each are fetched one at a time, since the point of moving them off
   * the database is that they do not all fit in memory at once.
   *
   * @param withDatabaseCopy Only the assets whose bytes are in their own row, which is what the
   *   database target holds. For the offload action, which has nothing to move for the rest.
   */
  async listStoredAssets(
    siteId: string,
    { withDatabaseCopy }: { withDatabaseCopy?: boolean } = {}
  ): Promise<StorageAssetRef[]> {
    const rows = await WIKI.db
      .select({
        id: assetsTable.id,
        kind: assetsTable.kind,
        fileSize: assetsTable.fileSize,
        locale: treeTable.locale,
        folderPath: treeTable.folderPath,
        fileName: treeTable.fileName
      })
      .from(assetsTable)
      .innerJoin(treeTable, eq(treeTable.id, assetsTable.id))
      .where(
        withDatabaseCopy
          ? and(eq(assetsTable.siteId, siteId), isNotNull(assetsTable.data))
          : eq(assetsTable.siteId, siteId)
      )

    return rows.map((row) => ({
      id: row.id,
      siteId,
      locale: row.locale,
      folderPath: decodeTreePath(row.folderPath ?? '') ?? '',
      fileName: row.fileName,
      kind: row.kind,
      fileSize: row.fileSize ?? 0
    }))
  }

  /**
   * Ask the target holding each of these assets to follow where the tree has since put them.
   *
   * Called after a rename, the tree rows already being correct: `getStorageRefs` reads the
   * destination off them, and the caller says where each one came from. Every target holding the
   * asset moves its own copy.
   */
  async relocateAssets(
    siteId: string,
    moves: { id: string; previous: { locale: string; folderPath: string; fileName: string } }[],
    actorId?: string
  ): Promise<void> {
    const refs = await this.getStorageRefs(
      siteId,
      moves.map((move) => move.id),
      actorId
    )
    for (const ref of refs) {
      const previous = moves.find((move) => move.id === ref.id)?.previous
      if (previous) {
        await WIKI.models.storage.relocateAsset(ref, previous)
      }
    }
  }

  /**
   * Take a file a storage target already holds into the wiki, without writing it anywhere.
   *
   * The other direction from an upload: the bytes are already in place — restored from a backup,
   * dropped into the folder by another tool — and what is missing is the wiki's record of them. A file
   * the wiki has no entry for is adopted where it lies rather than written out again, which is why
   * nothing is dispatched to the storage layer for it. Any *other* target configured to hold that kind
   * will not have a copy until its own export action runs.
   *
   * `overwrite` turns the case the wiki DOES have an entry for from a skip into a replacement, for a
   * restore where the folder is meant to be the authority. That one is dispatched, and has to be: the
   * wiki's copy of those bytes may be what a reader is served — from the database target, typically —
   * so leaving the other targets on the old file would make the import appear to have done nothing.
   * There is no history behind an asset, so unlike an overwritten page the bytes it replaces are gone.
   *
   * Whatever `overwrite` says, only an *asset* is ever replaced. A page or a folder owning the name is
   * left alone: a page's own file belongs to the other half of the import, and neither is something a
   * loose file in a folder may take over.
   *
   * @param overwrite Replace an asset already at this path instead of leaving it alone
   * @returns The asset, or null for a file this passed over
   */
  async adoptStoredFile({
    siteId,
    locale,
    folderPath,
    fileName,
    data,
    authorId,
    overwrite
  }: {
    siteId: string
    locale: string
    folderPath: string
    fileName: string
    data: Buffer
    authorId: string
    overwrite?: boolean
  }): Promise<Asset | null> {
    const safeName = sanitizeFileName(fileName)
    if (!safeName) {
      return null
    }

    // -> Read in full rather than as an existence check, since replacing one needs its ID and the
    //    name and title it is already filed under
    const occupant = await WIKI.models.tree.getEntryAt({
      siteId,
      locale,
      parentPath: folderPath,
      fileName: safeName
    })
    if (occupant && (!overwrite || occupant.type !== 'asset')) {
      return null
    }

    const fileExt = extensionOf(safeName)
    try {
      await this.guardAgainstPageCollision({
        siteId,
        locale,
        folderPath,
        fileName: safeName,
        fileExt
      })
    } catch {
      // -> Skipped rather than reported, as everything else this passes over is: the caller is
      //    walking a folder, and a file that is really a page belongs to the other half of the import
      return null
    }
    const mimeType = mime.getType(safeName) ?? 'application/octet-stream'
    const kind = kindOf(mimeType, fileExt)
    const preview =
      kind === 'image'
        ? await makeImageThumbnail(data, THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height)
        : null
    const dimensions = kind === 'image' ? await readImageDimensions(data) : null

    if (occupant) {
      return this.replace({
        id: occupant.id,
        siteId,
        locale,
        folderPath: decodeTreePath(occupant.folderPath ?? '') ?? '',
        // -> The names it is already filed under, not the ones off the file: they only differ by
        //    sanitization, and the entry is the authority on what it is actually called
        fileName: occupant.fileName,
        title: occupant.title,
        fileExt,
        kind,
        mimeType,
        data,
        preview,
        dimensions,
        authorId
      })
    }

    const entry = await WIKI.models.tree.addAsset({
      parentPath: folderPath,
      fileName: safeName,
      title: safeName,
      locale,
      siteId,
      meta: { fileSize: data.length, fileExt, mimeType, ...dimensionMeta(dimensions) }
    })

    try {
      await WIKI.db.insert(assetsTable).values({
        id: entry.id,
        fileName: entry.fileName,
        fileExt,
        kind,
        mimeType,
        fileSize: data.length,
        meta: dimensionMeta(dimensions),
        preview,
        authorId,
        siteId
      })
    } catch (err) {
      await WIKI.db.delete(treeTable).where(eq(treeTable.id, entry.id))
      throw err
    }

    const importedFolderPath = decodeTreePath(entry.folderPath ?? '') ?? ''
    WIKI.models.hooks.emit('asset:upload', {
      id: entry.id,
      fileName: entry.fileName,
      folderPath: importedFolderPath,
      siteId,
      authorId,
      metadata: { fileSize: data.length, mimeType, kind }
    })

    return {
      id: entry.id,
      fileName: entry.fileName,
      fileExt,
      kind,
      mimeType,
      fileSize: data.length,
      folderPath: importedFolderPath,
      locale,
      title: entry.title,
      hasPreview: Boolean(preview),
      ...dimensionMeta(dimensions),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
  }

  /**
   * An asset's thumbnail, or null when it has none — which is the normal state for anything that is
   * not an image, and for images uploaded while Sharp was unavailable.
   *
   * Always read from the database, whichever target holds the file itself. A preview is a few
   * kilobytes generated by this model rather than anything a user uploaded, and the file manager asks
   * for a screenful of them at a time — there is nothing to gain by sending that around a storage
   * module, and a target being slow or misconfigured would cost a wiki its whole file browser.
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

  /**
   * Drop both serving caches of this instance.
   *
   * Nothing is lost: the metadata is read back from the database on the next request for a path, and
   * the bytes on the next request for a file. What it costs is the refill — every image on the next
   * page view goes to the database once — which is the price of being certain nothing stale is being
   * served.
   */
  async purgeCache(): Promise<void> {
    this.pathCache.clear()
    this.writtenSinceSweep = 0
    await fs.rm(this.cachePath, { recursive: true, force: true })
    await fs.mkdir(this.cachePath, { recursive: true })
    WIKI.logger.info('Purged the file cache [ OK ]')
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
   * Rename an asset, move it to another folder, or both.
   *
   * One operation rather than two, because to a storage target they are the same one: a file's path
   * under a target is its folder and its name together, so either half changing is the same copy
   * moved to a new place. The wiki's own rows are what decide where that is, and this rewrites them
   * before asking every target to follow.
   *
   * A locale is part of that address too -- a target brackets its tree by locale unless the site says
   * otherwise -- so moving between locales is the same operation again, and the folder the file lands
   * in is that locale's, created if that locale does not have one yet.
   *
   * @param fileName What to call it, sanitized. Keeps its current name when absent.
   * @param folderPath Which folder to put it in, from the site root, empty for the root itself.
   *                   Created if it does not exist. Stays where it is when absent.
   * @param locale Which locale's tree to put it in. Stays in its own when absent.
   * @returns The updated metadata, or null if there is no such asset on this site
   */
  async moveAsset(
    siteId: string,
    id: string,
    { fileName, folderPath, locale }: { fileName?: string; folderPath?: string; locale?: string },
    actorId?: string
  ): Promise<Asset | null> {
    const asset = await this.getAsset(siteId, id)
    const entry = await WIKI.models.tree.getById(id)
    if (!asset || !entry) {
      return null
    }
    const safeName = fileName === undefined ? asset.fileName : sanitizeFileName(fileName)
    if (!safeName) {
      throw new CustomError('assetInvalidFileName', 'This file name cannot be used.')
    }
    const fileExt = extensionOf(safeName)
    if (!fileExt) {
      throw new CustomError('assetInvalidFileName', 'The file name must keep a file extension.')
    }
    const destination =
      folderPath === undefined ? asset.folderPath : normalizeFolderPath(folderPath)
    const destinationLocale = locale || entry.locale
    const isRenamed = safeName !== asset.fileName
    // -> One question rather than two: a file in another locale's tree is somewhere else as surely as
    //    one in another folder, and everything below has to treat the pair as the destination
    const isRelocated = destination !== asset.folderPath || destinationLocale !== entry.locale
    if (!isRenamed && !isRelocated) {
      return asset
    }

    // -> The same two rules an upload is held to, asked of where it is GOING: renaming is another way
    //    of arriving at a name, and `readme.pdf` renamed to `readme.md` -- or carried into the folder
    //    holding the page `readme` -- would land on that page just as squarely
    await this.guardAgainstPageCollision({
      siteId,
      locale: destinationLocale,
      folderPath: destination,
      fileName: safeName,
      fileExt
    })

    let storedName = safeName
    if (isRelocated) {
      /*
        Asked before anything is written, because the write cannot take it back: the tree entry is
        MOVED rather than rewritten -- deleted and re-added, so that the folders the destination needs
        get created and the ones it leaves stop counting it -- and a name refused halfway through that
        would leave the asset row with no entry pointing at it. `addAsset` still settles a name that
        was taken in between by suffixing it, which keeps the two rows consistent where failing would
        not; `storedName` is read back off the row rather than assumed for exactly that case.
      */
      const occupant = await WIKI.models.tree.getEntryAt({
        siteId,
        locale: destinationLocale,
        parentPath: destination,
        fileName: safeName
      })
      if (occupant) {
        throw new CustomError(
          'assetNameTakenByEntry',
          `A ${occupant.type} with this name already exists there.`,
          409
        )
      }
      await WIKI.models.tree.deleteEntry(id)
      const moved = await WIKI.models.tree.addAsset({
        id,
        parentPath: destination,
        fileName: safeName,
        title: safeName,
        locale: destinationLocale,
        siteId,
        tags: entry.tags,
        meta: entry.meta
      })
      storedName = moved.fileName
    } else {
      await WIKI.models.tree.renameEntry({ id, fileName: safeName, title: safeName })
    }
    // -> Off the stored name rather than off the requested one, since the two differ where a move had
    //    to settle a collision
    const storedExt = extensionOf(storedName)
    const resolvedMime = mime.getType(storedName) ?? asset.mimeType

    await WIKI.db
      .update(assetsTable)
      .set({
        fileName: storedName,
        fileExt: storedExt,
        mimeType: resolvedMime,
        kind: kindOf(resolvedMime, storedExt),
        updatedAt: sql`now()`
      })
      .where(eq(assetsTable.id, id))
    // -> The tree carries its own copy of these, and it is what a folder listing reads. The bytes are
    //    untouched by either half of this, so whatever was measured of them is carried across rather
    //    than rebuilt: nothing here has the file in hand to measure it again.
    await WIKI.db
      .update(treeTable)
      .set({
        meta: {
          fileSize: asset.fileSize,
          fileExt: storedExt,
          mimeType: resolvedMime,
          ...dimensionMeta(dimensionsOf(asset))
        }
      })
      .where(eq(treeTable.id, id))

    // -> Every target holding this asset lays its copy out by path, so each of them has a file to
    //    move now that the tree rows have been rewritten
    await this.relocateAssets(
      siteId,
      [
        {
          id,
          previous: {
            locale: entry.locale,
            folderPath: asset.folderPath,
            fileName: asset.fileName
          }
        }
      ],
      actorId
    )

    // -> Both ends of the move: the name it left, and the name it took, which something else may have
    //    been resolved at before it was freed up
    this.forgetPath(siteId, asset.folderPath, asset.fileName)
    this.forgetPath(siteId, destination, storedName)
    await this.dropCachedContent([id])

    WIKI.models.hooks.emit('asset:rename', {
      id,
      fileName: storedName,
      previousFileName: asset.fileName,
      folderPath: destination,
      previousFolderPath: asset.folderPath,
      locale: destinationLocale,
      previousLocale: entry.locale,
      siteId
    })

    return this.getAsset(siteId, id)
  }

  /**
   * Delete an asset and the tree entry that points at it.
   *
   * @returns Whether an asset was deleted
   */
  async deleteAsset(siteId: string, id: string, actorId?: string): Promise<boolean> {
    const asset = await this.getAsset(siteId, id)
    if (!asset) {
      return false
    }
    // -> Read before the rows go: where an asset sits is the tree's to say, and the tree row is
    //    about to be deleted along with it
    const [ref] = await this.getStorageRefs(siteId, [id], actorId)
    await WIKI.db.delete(assetsTable).where(eq(assetsTable.id, id))
    await WIKI.models.tree.deleteEntry(id)
    if (ref) {
      await WIKI.models.storage.removeAsset(ref)
    }

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
  async deleteOrphaned(siteId: string, entries: DeletedEntry[], actorId?: string): Promise<void> {
    if (entries.length < 1) {
      return
    }
    const ids = entries.map((entry) => entry.id)
    /*
      Where each asset sat is rebuilt from what the folder deletion reported, not looked up: the tree
      rows went with the folder, and they were the only thing that placed these assets. What is still
      here is the `assets` row, which is where the kind and size come from — a target needs both to
      work out whether it was holding the file at all.
    */
    const stored = new Map(
      (
        await WIKI.db
          .select({ id: assetsTable.id, kind: assetsTable.kind, fileSize: assetsTable.fileSize })
          .from(assetsTable)
          .where(inArray(assetsTable.id, ids))
      ).map((row) => [row.id, row])
    )
    await WIKI.db.delete(assetsTable).where(inArray(assetsTable.id, ids))

    for (const entry of entries) {
      const row = stored.get(entry.id)
      if (row) {
        await WIKI.models.storage.removeAsset({
          id: entry.id,
          siteId,
          actorId,
          locale: entry.locale,
          folderPath: entry.folderPath,
          fileName: entry.fileName,
          kind: row.kind,
          fileSize: row.fileSize ?? 0
        })
      }
    }

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
