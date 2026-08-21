import { eq } from 'drizzle-orm'
import { assets as assetsTable } from '../../../db/schema.ts'
import { CONTENT_TYPES } from '../../../models/storage.ts'
import type { StorageModule, StorageTarget } from '../../../models/storage.ts'

/** Byte counts as an administrator reads them, for reporting how much a run gave back. */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
}

/**
 * Database storage module
 *
 * Holds an asset's bytes in the `data` column of its own row, which is where everything lands until
 * a site turns another target on. There is nothing to configure and nothing that can be
 * misconfigured: if the wiki is running, this target works.
 *
 * The bytes sit next to the metadata rather than anywhere addressable, so nothing has to be recorded
 * about where they went and a rename moves nothing.
 *
 * Its one action, `offloadUnchecked`, is the way back out of that: a site that has since enabled
 * another target is still carrying every asset uploaded before it, and nothing in the ordinary course
 * of things ever moves those.
 */
const dbStorage: StorageModule = {
  async putAsset(_target, ref, data) {
    await WIKI.db.update(assetsTable).set({ data }).where(eq(assetsTable.id, ref.id))
  },

  async getAsset(_target, ref) {
    const rows = await WIKI.db
      .select({ data: assetsTable.data })
      .from(assetsTable)
      .where(eq(assetsTable.id, ref.id))
      .limit(1)
    return rows[0]?.data ?? null
  },

  async deleteAsset(_target, ref) {
    // -> Clearing the column rather than deleting the row: this runs when the site stops storing
    //    that kind of file here as well as when the asset itself is going, and in the latter case
    //    the row is deleted by the assets model anyway
    await WIKI.db.update(assetsTable).set({ data: null }).where(eq(assetsTable.id, ref.id))
  },

  async moveAsset() {
    // -> A row is not addressed by the name of the file it holds
  },

  /*
    The page handlers do nothing, and that is the whole of what this module has to say about pages.

    Every other target holding pages is keeping a copy of them; this one is not a copy but the thing
    itself. A page's source is a column of its own row, written by the pages model before any of this
    is reached, and its `pages` content type is ticked and locked in the admin area to say exactly
    that. There is no second write to make here, and a delete takes the row with it.
  */

  async putPage() {},

  async deletePage() {},

  async movePage() {},

  /**
   * Move the bytes of every content type this target no longer holds onto the targets that do, and
   * then let go of them.
   *
   * The way a site that started out keeping everything in its database stops doing so. Turning
   * another target on only affects what is uploaded *from then on*, so untick images here and the
   * database is still carrying every image ever uploaded — reachable by nothing, since a target is
   * only read for a content type it is configured to store. This is what finishes that job: it reads
   * each of those assets out of its row, puts it on the targets that are supposed to have it, and only
   * then clears the column.
   *
   * **Only the metadata stays.** The row, its name, its size, its thumbnail and its place in the tree
   * are untouched — `data` is the one column this empties, and every asset goes on being served from
   * wherever it now lives.
   *
   * Three rules, and the first two are what make it safe to run:
   *
   * 1. **Nothing is cleared that is not somewhere else first.** The write to each destination is
   *    read straight back, and a byte count that does not match is a failure for that asset — it
   *    keeps its database copy and the run carries on to the next. This is the only copy of the
   *    bytes; a target that reports a successful write it did not do must not be taken at its word.
   * 2. **An asset with nowhere to go keeps its copy.** A content type unticked here and enabled
   *    nowhere else has no destination at all, and clearing those rows would simply delete the
   *    files. They are reported as stranded, and the fix is to enable a target for them.
   * 3. **Only unticked types are touched**, so this is how the administrator says what to move: it
   *    is the Content Types form above that decides, not this action. `pages` can never be among
   *    them — the database is not keeping a copy of a page, it *is* the page.
   *
   * The bytes are written to every enabled target holding the type rather than only to the one
   * nominated for delivery. That nomination is where reads *start*, and a target can only hold it if
   * it stores the type anyway — but the others are the fallback list behind it, and this is the last
   * moment at which they can be brought up to date from a copy known to be current.
   *
   * Postgres gives the space back on its own schedule: the rows are emptied here, and the file on
   * disk shrinks when autovacuum gets to the table.
   */
  async offloadUnchecked(target: StorageTarget): Promise<string> {
    // -> Whatever this target no longer claims. `pages` is never in it: the column this action
    //    empties holds assets, and a page's source is a column of its own row that nothing offloads.
    const unchecked = CONTENT_TYPES.filter(
      (type) => type !== 'pages' && !target.contentTypes.activeTypes.includes(type)
    )
    if (unchecked.length < 1) {
      return 'The database is still configured to hold every content type, so there is nothing to offload. Untick the ones you want moved off it first.'
    }

    let moved = 0
    let freed = 0
    let stranded = 0
    let failed = 0

    for (const ref of await WIKI.models.assets.listStoredAssets(target.siteId, {
      withDatabaseCopy: true
    })) {
      const contentType = WIKI.models.storage.contentTypeFor(target.siteId, ref.kind, ref.fileSize)
      if (!unchecked.includes(contentType)) {
        continue
      }

      // -> Every target that is supposed to be holding this asset, which is this one aside from the
      //    same list an upload of it would be written to today
      const destinations = (
        await WIKI.models.storage.writeTargetsFor(ref.siteId, ref.kind, ref.fileSize)
      ).filter((dest) => dest.id !== target.id)
      if (destinations.length < 1) {
        stranded++
        continue
      }

      const data = await dbStorage.getAsset(target, ref)
      if (!data) {
        continue
      }

      try {
        for (const dest of destinations) {
          const mod = await WIKI.models.storage.ensureModule(dest.module)
          if (!mod) {
            throw new Error(`the ${dest.title} module has no implementation installed`)
          }
          await mod.putAsset(dest, ref, data)
          // -> Read back rather than trusted. What follows deletes the only copy, so "the write did
          //    not throw" is not enough of an assurance to delete anything on.
          const stored = await mod.getAsset(dest, ref)
          if (!stored || stored.length !== data.length) {
            throw new Error(`${dest.title} did not have the file back afterwards`)
          }
        }
      } catch (err: any) {
        failed++
        WIKI.logger.warn(
          `Could not offload the asset ${ref.folderPath ? `${ref.folderPath}/` : ''}${ref.fileName} [ SKIPPED ]`
        )
        WIKI.logger.warn(err.message)
        continue
      }

      await dbStorage.deleteAsset(target, ref)
      moved++
      freed += data.length
    }

    WIKI.logger.info(
      `Offloaded ${moved} asset(s) totalling ${formatSize(freed)} out of the database [ OK ]`
    )
    const parts = []
    if (moved > 0) {
      parts.push(`Offloaded ${moved} asset(s), freeing ${formatSize(freed)} in the database.`)
    } else {
      parts.push('There was nothing to offload.')
    }
    if (stranded > 0) {
      parts.push(
        `${stranded} were left in place: no other enabled target is configured to store them. Enable one and run this again.`
      )
    }
    if (failed > 0) {
      parts.push(
        `${failed} could not be written to every target and kept their database copy - see the server log.`
      )
    }
    return parts.join(' ')
  }
}

export default dbStorage
