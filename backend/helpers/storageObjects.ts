import mime from 'mime'
import { assetRelPath, pageRelPath, serializePage } from './storageFiles.ts'
import type { StorageModule, StoragePageRef, StorageTarget } from '../models/storage.ts'

/**
 * The shared half of every object-store target — S3, Azure Blob Storage, Google Cloud Storage.
 *
 * All three answer the same four questions (put, get, remove, copy) against a flat namespace of keys,
 * and everything above that is identical between them: which key a page or an asset takes, how a
 * rename is done where there is no rename, what a bulk export walks. That part lives here, so a
 * module is its client and nothing else.
 *
 * **A key is a path**, the same one the disk target would write — the target's own `pathPrefix` and
 * then whatever `pathPrefixFor` brackets the tree with, and pages and assets sit beside each other in
 * it exactly as they do in a folder. An object store has no directories, so the slashes are just
 * characters in a name, which is why there is nothing here about creating or pruning them.
 *
 * Not under `modules/storage/`, for the reason `storageFiles.ts` gives: a directory there without a
 * `definition.yml` takes every storage module down with it.
 */

/**
 * A direct-access URL as the shared layer asks for one.
 *
 * `key` rather than a ref, because signing is about an object and not about the wiki: the store has
 * to know what to declare the response as and whether to make the browser save it, both of which the
 * wiki knows and the object may not have been stored with.
 */
export interface PresignRequest {
  key: string
  expiresInSeconds: number
  contentType: string
  /** The file name to save as, when the browser should save rather than display. */
  downloadAs?: string
}

/**
 * The origin a signed URL should be built on, or null for the store's own.
 *
 * Normalized to no trailing slash so that a module can always join it to a key with one, however the
 * administrator typed it.
 */
export function signingBaseUrl(target: StorageTarget): string | null {
  const configured = target.assetDelivery.baseUrl?.trim()
  return configured ? configured.replace(/\/+$/, '') : null
}

/**
 * The target's own prefix inside the bucket, as path segments.
 *
 * Empty by default — the wiki's tree starts at the root of the bucket, which is what a bucket made
 * for it should look like. A prefix is what lets one bucket hold this wiki beside something else, or
 * beside another wiki: an object store has no folders to keep two of them apart, so the only thing
 * that can is the keys agreeing to stay on their own side.
 *
 * Normalized rather than rejected. Leading, trailing and doubled slashes all mean the same folder to
 * anybody typing one, and `.` and `..` segments are dropped rather than resolved, because a key is a
 * literal name and neither of them means in a bucket what it means in a path — `a/../b` and `b` are
 * two different objects to every one of these stores.
 */
function prefixSegments(target: StorageTarget): string[] {
  return String(target.config.pathPrefix ?? '')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

/**
 * The key an object takes: this target's prefix, then the path the disk target would have written.
 *
 * Two prefixes rather than one because they answer different questions. Where the tree sits *within*
 * a location is the site's answer and the same for every target of it, which is `pathPrefixFor`;
 * which subdirectory of this bucket that tree starts in is this target's alone, the same way the
 * bucket itself is. Object stores only — a path-based target has a configured root to be the
 * equivalent, and the leading segments of a key are the closest a flat namespace comes to one.
 *
 * @returns Null for content this site's layout has no place for, exactly as the relative path does
 */
function objectKey(target: StorageTarget, relPath: string | null): string | null {
  if (!relPath) {
    return null
  }
  const prefix = prefixSegments(target)
  return prefix.length > 0 ? `${prefix.join('/')}/${relPath}` : relPath
}

/** Where an asset's object sits in this target's bucket. */
function assetKey(
  target: StorageTarget,
  ref: { locale: string; folderPath: string; fileName: string }
): string | null {
  return objectKey(target, assetRelPath(target, ref))
}

/** Where a page's object sits in this target's bucket. */
function pageKey(target: StorageTarget, ref: StoragePageRef): string | null {
  return objectKey(target, pageRelPath(target, ref))
}

/** What a store has to be able to do for `objectStorageModule` to build a target out of it. */
export interface ObjectStoreClient {
  /** Write an object, replacing whatever was at that key. */
  put: (target: StorageTarget, key: string, data: Buffer, contentType: string) => Promise<void>
  /** Read one back, or null when the store does not have it. Must not throw for a missing key. */
  get: (target: StorageTarget, key: string) => Promise<Buffer | null>
  /** Drop one. Must not throw for a key that is already gone. */
  remove: (target: StorageTarget, key: string) => Promise<void>
  /**
   * Copy one key onto another, server-side where the store can.
   *
   * @returns Whether there was anything at the source. False rather than a throw, because a target
   *   enabled after an upload legitimately has no copy of the file being moved.
   */
  copy: (target: StorageTarget, fromKey: string, toKey: string) => Promise<boolean>
  /**
   * Sign a URL a reader can fetch the object from without going through the wiki.
   *
   * Optional only in the type: all three object stores implement it, and a store that could not
   * would declare `isDirectAccessSupported: false` and never be asked.
   */
  presign?: (target: StorageTarget, request: PresignRequest) => Promise<string | null>
}

/**
 * What to declare an object as, so that a store handing it straight to a browser says the right thing.
 *
 * Guessed from the name rather than taken from the asset, because the reference a target is given
 * carries the file's size and kind but not its type — and the name is what the wiki itself resolves
 * the served type from, so guessing the same way keeps the two in step.
 */
function contentTypeOf(fileName: string): string {
  return mime.getType(fileName) ?? 'application/octet-stream'
}

/**
 * Turn a client into a storage module.
 *
 * The eight contract methods plus `exportAll`, which is the one action all three declare. A module
 * spreads the result and adds nothing, unless its store can do something the others cannot.
 */
export function objectStorageModule(client: ObjectStoreClient): StorageModule {
  const module: StorageModule = {
    canStore(target, ref) {
      return WIKI.models.storage.pathPrefixFor(target.siteId, ref.locale) !== null
    },

    async putAsset(target, ref, data) {
      const key = assetKey(target, ref)
      // -> Guarded rather than skipped: the model asks `canStore` before dispatching a write, so
      //    reaching this means somebody wrote without asking, and an asset's bytes may exist nowhere
      //    else
      if (!key) {
        throw new Error(
          `${target.title} has no path for ${ref.locale} content, so ${ref.fileName} cannot be stored there.`
        )
      }
      await client.put(target, key, data, contentTypeOf(ref.fileName))
    },

    async getAsset(target, ref) {
      const key = assetKey(target, ref)
      return key ? client.get(target, key) : null
    },

    async deleteAsset(target, ref) {
      const key = assetKey(target, ref)
      if (key) {
        await client.remove(target, key)
      }
    },

    async moveAsset(target, ref, previous) {
      await moveObject(
        client,
        target,
        assetKey(target, { ...ref, ...previous }),
        assetKey(target, ref)
      )
    },

    async putPage(target, ref, page) {
      const key = pageKey(target, ref)
      // -> Unlike an asset, a page with no place here is not worth failing over: it is in the
      //    database, which is where a page always is, and this copy is the thing the site declined
      if (!key) {
        return
      }
      await client.put(
        target,
        key,
        Buffer.from(serializePage(ref, page), 'utf8'),
        contentTypeOf(key)
      )
    },

    async deletePage(target, ref) {
      const key = pageKey(target, ref)
      if (key) {
        await client.remove(target, key)
      }
    },

    async movePage(target, ref, previousPath) {
      await moveObject(
        client,
        target,
        pageKey(target, { ...ref, path: previousPath }),
        pageKey(target, ref)
      )
    },

    ...(client.presign
      ? {
          async presignAsset(target, ref, options) {
            const key = assetKey(target, ref)
            if (!key) {
              return null
            }
            return client.presign!(target, { key, ...options })
          }
        }
      : {}),

    /**
     * Write a copy of everything this target is configured to hold into the store.
     *
     * How content that predates the target being enabled gets into it: an upload only ever goes to
     * the targets enabled at the time, so a store turned on today holds nothing from yesterday. A
     * plain copy and nothing more — no database row is touched, nothing is repointed, and running it
     * twice does the same work to the same effect.
     */
    async exportAll(target: StorageTarget): Promise<string> {
      let assets = 0
      let unreadable = 0
      let unstored = 0

      for (const asset of await WIKI.models.assets.listStoredAssets(target.siteId)) {
        const contentType = WIKI.models.storage.contentTypeFor(
          target.siteId,
          asset.kind,
          asset.fileSize
        )
        if (!target.contentTypes.activeTypes.includes(contentType)) {
          continue
        }
        if (!assetKey(target, asset)) {
          unstored++
          continue
        }
        const data = await WIKI.models.storage.getAsset(asset)
        if (!data) {
          unreadable++
          continue
        }
        await module.putAsset(target, asset, data)
        assets++
      }

      let pages = 0
      if (target.contentTypes.activeTypes.includes('pages')) {
        for (const { ref, content } of await WIKI.models.pages.listForStorage(target.siteId)) {
          if (!pageKey(target, ref)) {
            unstored++
            continue
          }
          await module.putPage(target, ref, content)
          pages++
        }
      }

      WIKI.logger.info(`Exported ${assets} asset(s) and ${pages} page(s) to ${target.title} [ OK ]`)
      const parts = []
      if (assets > 0 || pages > 0) {
        parts.push(`Exported ${pages} page(s) and ${assets} asset(s).`)
      } else {
        parts.push('There was nothing to export.')
      }
      if (unreadable > 0) {
        parts.push(`${unreadable} asset(s) could not be read and were skipped.`)
      }
      if (unstored > 0) {
        const { primaryLocale } = WIKI.models.storage.pathLayoutFor(target.siteId)
        parts.push(
          `${unstored} item(s) are not in the ${primaryLocale} locale, which is the only one this site stores.`
        )
      }
      return parts.join(' ')
    }
  }

  return module
}

/**
 * Follow a rename, which in an object store is a copy and a delete.
 *
 * Either end may be nowhere, as on disk: the layout can have no path for a locale, and a move may
 * cross into or out of it. Moving *into* it has nothing to copy from; moving out of it leaves an
 * object behind at the old key, so that one is a delete.
 *
 * The delete only happens once the copy has reported success, so a store that fails halfway leaves
 * the file at its old key rather than nowhere.
 */
async function moveObject(
  client: ObjectStoreClient,
  target: StorageTarget,
  fromKey: string | null,
  toKey: string | null
): Promise<void> {
  if (!fromKey) {
    return
  }
  if (!toKey) {
    await client.remove(target, fromKey)
    return
  }
  if (await client.copy(target, fromKey, toKey)) {
    await client.remove(target, fromKey)
  }
}
