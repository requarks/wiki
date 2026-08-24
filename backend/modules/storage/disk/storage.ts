import fs from 'node:fs/promises'
import path from 'node:path'
import {
  absPathIn,
  assetRelPath,
  importTree,
  moveStored,
  pageRelPath,
  pruneEmptyDirs,
  resolveRoot,
  serializePage,
  writeFileAtomic
} from '../../../helpers/storageFiles.ts'
import type { ImportSummary } from '../../../helpers/storageFiles.ts'
import type { StorageModule, StorageTarget } from '../../../models/storage.ts'

/** Where files go when the target has no path configured, matching the definition's default. */
const DEFAULT_PATH = './data/content'

/** The root this target writes under, as an absolute path. */
function baseDir(target: StorageTarget): string {
  return resolveRoot(target.config.path, DEFAULT_PATH)
}

/** What an import run did, in the words the two import actions report it with. */
function describeImport(summary: ImportSummary | null, overwrite: boolean): string {
  if (!summary) {
    return 'There is nothing in the storage folder for this site yet.'
  }
  WIKI.logger.info(`Imported ${summary.pages} page(s) and ${summary.assets} asset(s) [ OK ]`)
  // -> Nothing is reported as merely imported when a run could have replaced something: an
  //    administrator reading "Imported 40 pages" has to be able to tell which of the two they ran
  const verb = overwrite ? 'Imported or replaced' : 'Imported'
  const parts = []
  if (summary.pages > 0) {
    parts.push(`${verb} ${summary.pages} page(s).`)
  }
  if (summary.assets > 0) {
    parts.push(`${verb} ${summary.assets} asset(s).`)
  }
  if (parts.length < 1) {
    parts.push(overwrite ? 'There was nothing to import.' : 'There was nothing new to import.')
  }
  if (summary.skipped > 0) {
    // -> With `overwrite` the only thing left to skip is a name a page or a folder owns, which is not
    //    something this action was ever going to take over
    parts.push(
      overwrite
        ? `${summary.skipped} could not replace what is at their path and were left alone.`
        : `${summary.skipped} were already in the wiki and were left alone.`
    )
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} could not be imported - see the server log.`)
  }
  return parts.join(' ')
}

/**
 * Local file system storage module
 *
 * Mirrors the wiki's own tree onto disk under the folder the target is configured with, laid out
 * `<locale>/<folders…>/<file>` by default — so that what an administrator sees in the file manager is
 * what they find in the folder, and so that a wiki's content remains ordinary files: readable, backed
 * up and served by whatever else is on the machine. Pages and assets share that tree, a page filed
 * under its editor's extension; keeping the two from colliding belongs to the models, not here.
 *
 * What brackets that tree is the site's to say and not this module's: the site id, the locale, both or
 * neither, per `pathPrefixFor`. The folder is normally the site's own, since a target belongs to
 * exactly one site — two sites sharing a path is what the site id prefix is for. With the locale
 * prefix off the site stores its primary locale and nothing else, so a file in another locale has no
 * path here at all, and every operation below has to say what it does about that.
 *
 * Nothing records where a file went. Every path is derived from the ref it is given, the same way
 * every time, which is what lets a copy be read back, moved or deleted with nothing stored about
 * where it sits — and what makes a folder written by one instance mean the same thing to the next.
 *
 * Where assets and pages differ is in what a failure costs. An **asset** may have no copy anywhere
 * else, so writes are atomic and a failure is raised for the caller to fail the upload on. A **page**
 * is a database row and always will be, so what sits here is a rendering of it written after the
 * fact, never read back, and allowed to fail.
 *
 * Everything about the shape of the tree itself — the front matter, what makes a file a page, the
 * walk an import does — is in `helpers/storageFiles.ts`, shared with the git target, which keeps the
 * same tree inside a repository.
 */
const diskStorage: StorageModule = {
  canStore(target, ref) {
    return WIKI.models.storage.pathPrefixFor(target.siteId, ref.locale) !== null
  },

  async putAsset(target, ref, data) {
    const relPath = assetRelPath(target, ref)
    // -> Guarded rather than skipped, unlike every read and delete below: the model asks `canStore`
    //    before it dispatches a write, so reaching this means somebody wrote to this target without
    //    asking, and dropping the only copy of an asset's bytes is not a thing to do quietly
    if (!relPath) {
      throw new Error(
        `${target.title} has no path for ${ref.locale} content, so ${ref.fileName} cannot be stored there.`
      )
    }
    await writeFileAtomic(absPathIn(baseDir(target), relPath), data)
  },

  async getAsset(target, ref) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      return null
    }
    try {
      return await fs.readFile(absPathIn(baseDir(target), relPath))
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
      // -> This target does not have the file: it was enabled after the asset was uploaded, or the
      //    folder was emptied from outside the wiki. Not a fault — the caller asks the next target.
      return null
    }
  },

  async deleteAsset(target, ref) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      return
    }
    const root = baseDir(target)
    const filePath = absPathIn(root, relPath)
    await fs.rm(filePath, { force: true })
    await pruneEmptyDirs(root, path.dirname(filePath))
  },

  async moveAsset(target, ref, previous) {
    await moveStored(
      baseDir(target),
      assetRelPath(target, { ...ref, ...previous }),
      assetRelPath(target, ref)
    )
  },

  async putPage(target, ref, page) {
    const relPath = pageRelPath(target, ref)
    // -> Unlike an asset, a page that has no place here is not a failure worth reporting: it is in
    //    the database, which is where a page always is, and this copy is the thing the site declined
    if (!relPath) {
      return
    }
    await writeFileAtomic(absPathIn(baseDir(target), relPath), serializePage(ref, page))
  },

  async deletePage(target, ref) {
    // -> Exactly one name, taken from the page's own content type. Guessing at the others would mean
    //    deleting whatever happens to sit beside it: in this folder `readme.html` is as likely to be
    //    an attachment as it is to be the page `readme`.
    const relPath = pageRelPath(target, ref)
    if (!relPath) {
      return
    }
    const root = baseDir(target)
    const filePath = absPathIn(root, relPath)
    await fs.rm(filePath, { force: true })
    await pruneEmptyDirs(root, path.dirname(filePath))
  },

  async movePage(target, ref, previous) {
    // -> Which editor wrote it does not change when a page moves, so both ends share an extension
    await moveStored(
      baseDir(target),
      pageRelPath(target, { ...ref, ...previous }),
      pageRelPath(target, ref)
    )
  },

  /**
   * Write a copy of everything this target is configured to hold to the file system.
   *
   * A plain export, and deliberately nothing more: it reads content from wherever it currently lives
   * and writes it here, overwriting whatever is already at each path. Nothing in the database is
   * touched — no asset is repointed at this target, and none of the space they take up elsewhere is
   * freed. Run it twice and the second run does the same work to the same effect.
   *
   * What that makes it useful for is having the folder be a faithful copy of the wiki on demand: a
   * backup to archive, a tree to hand to a static site generator, a starting point for another
   * instance to import. What it deliberately does not do is migrate: an asset already stored in the
   * database goes on being served from the database afterwards, and only content uploaded while this
   * target is enabled is stored here in the first place.
   */
  async exportAll(target: StorageTarget): Promise<string> {
    let assets = 0
    let unreadable = 0
    let unstored = 0
    for (const asset of await WIKI.models.assets.listStoredAssets(target.siteId)) {
      // -> Only what the current configuration says belongs here: an administrator who turned this
      //    target on for images alone did not ask for their videos to be written out as well
      const contentType = WIKI.models.storage.contentTypeFor(
        target.siteId,
        asset.kind,
        asset.fileSize
      )
      if (!target.contentTypes.activeTypes.includes(contentType)) {
        continue
      }
      // -> And only what the layout has somewhere to put: a site storing its primary locale alone
      //    has no path for the rest, and `putAsset` would refuse them one at a time
      if (!assetRelPath(target, asset)) {
        unstored++
        continue
      }
      const data = await WIKI.models.storage.getAsset(asset)
      if (!data) {
        unreadable++
        continue
      }
      await diskStorage.putAsset(target, asset, data)
      assets++
    }

    let pages = 0
    if (target.contentTypes.activeTypes.includes('pages')) {
      for (const { ref, content } of await WIKI.models.pages.listForStorage(target.siteId)) {
        if (!pageRelPath(target, ref)) {
          unstored++
          continue
        }
        await diskStorage.putPage(target, ref, content)
        pages++
      }
    }

    WIKI.logger.info(
      `Exported ${assets} asset(s) and ${pages} page(s) to ${baseDir(target)} [ OK ]`
    )
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
  },

  /**
   * Take everything in the folder that the wiki does not know about yet into the wiki.
   *
   * The direction that makes this folder a store rather than a dumping ground: content arrives here
   * from outside — restored from a backup, generated by another tool, unpacked from an archive — and
   * this is what turns it back into pages and assets. What counts as a page, and what happens to a
   * file that lands on something the wiki already has, are `importTree`'s to say.
   *
   * A path the wiki already has an entry at is left alone in both directions, which makes this safe
   * to run repeatedly and makes it no use for picking up a file that changed on both sides — that is
   * a merge, and this module has no history to do one from. `importAllOverwrite` is the answer for
   * the case where there is nothing to reconcile because the folder is simply right.
   */
  async importAll(target: StorageTarget, actorId: string): Promise<string> {
    return describeImport(
      await importTree({ target, root: baseDir(target), actorId, overwrite: false }),
      false
    )
  },

  /**
   * The same walk, with the folder winning every collision.
   *
   * For the case `importAll` deliberately refuses: not filling in what the wiki is missing but making
   * it say what the folder says — a restore onto an instance that already has content, or a tree
   * edited outside the wiki that is meant to be taken as the new truth.
   *
   * The two halves are not equally recoverable, which is the thing to know before running it. A
   * **page** is replaced by an ordinary save, so its previous version is in its history. An **asset**
   * has no history: its bytes are overwritten on every target holding them and the ones they replaced
   * are gone.
   */
  async importAllOverwrite(target: StorageTarget, actorId: string): Promise<string> {
    return describeImport(
      await importTree({ target, root: baseDir(target), actorId, overwrite: true }),
      true
    )
  }
}

export default diskStorage
