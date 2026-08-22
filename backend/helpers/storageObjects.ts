import mime from 'mime'
import { assetRelPath, pageRelPath, serializePage } from './storageFiles.ts'
import type { StorageModule, StorageTarget } from '../models/storage.ts'

/**
 * The shared half of every object-store target — S3, Azure Blob Storage, Google Cloud Storage.
 *
 * All three answer the same four questions (put, get, remove, copy) against a flat namespace of keys,
 * and everything above that is identical between them: which key a page or an asset takes, how a
 * rename is done where there is no rename, what a bulk export walks. That part lives here, so a
 * module is its client and nothing else.
 *
 * **A key is a path**, the same one the disk target would write — `pathPrefixFor` decides what
 * brackets it, and pages and assets sit beside each other in it exactly as they do in a folder. An
 * object store has no directories, so the slashes are just characters in a name, which is why there is
 * nothing here about creating or pruning them.
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
      const key = assetRelPath(target, ref)
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
      const key = assetRelPath(target, ref)
      return key ? client.get(target, key) : null
    },

    async deleteAsset(target, ref) {
      const key = assetRelPath(target, ref)
      if (key) {
        await client.remove(target, key)
      }
    },

    async moveAsset(target, ref, previous) {
      await moveObject(
        client,
        target,
        assetRelPath(target, { ...ref, ...previous }),
        assetRelPath(target, ref)
      )
    },

    async putPage(target, ref, page) {
      const key = pageRelPath(target, ref)
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
      const key = pageRelPath(target, ref)
      if (key) {
        await client.remove(target, key)
      }
    },

    async movePage(target, ref, previousPath) {
      await moveObject(
        client,
        target,
        pageRelPath(target, { ...ref, path: previousPath }),
        pageRelPath(target, ref)
      )
    },

    ...(client.presign
      ? {
          async presignAsset(target, ref, options) {
            const key = assetRelPath(target, ref)
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
        if (!assetRelPath(target, asset)) {
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
          if (!pageRelPath(target, ref)) {
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
