import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, inArray } from 'drizzle-orm'
import { blocks as blocksTable, sites as sitesTable } from '../db/schema.ts'

/** A block as declared by its component's `static definition`. */
export interface BlockDefinition {
  block: string
  name: string
  description: string
  icon: string
}

/** A block row as exposed by the API. */
export interface SiteBlock {
  id: string
  block: string
  name: string
  description: string
  icon: string
  isEnabled: boolean
  isCustom: boolean
  config: Record<string, any>
}

const blockSelection = {
  id: blocksTable.id,
  block: blocksTable.block,
  name: blocksTable.name,
  description: blocksTable.description,
  icon: blocksTable.icon,
  isEnabled: blocksTable.isEnabled,
  isCustom: blocksTable.isCustom,
  config: blocksTable.config
}

/**
 * Blocks model
 *
 * Built-in blocks live in the `blocks/` workspace, one directory per block. Their metadata is
 * declared as a `static definition` on each Lit component and collected into
 * `blocks/compiled/blocks.manifest.json` by the rollup build, which is what this model reads —
 * the components themselves cannot be imported outside a browser.
 */
class Blocks {
  /** Definitions read from the compiled manifest, refreshed by `refreshFromDisk()`. */
  definitions: BlockDefinition[] = []

  /**
   * Load the built-in block definitions from the compiled manifest.
   *
   * A missing manifest is not fatal: it just means `blocks` has not been built yet, in which case
   * only custom blocks are available.
   */
  async refreshFromDisk(): Promise<void> {
    const manifestPath = path.join(WIKI.ROOTPATH, 'blocks/compiled/blocks.manifest.json')
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      if (!Array.isArray(manifest)) {
        throw new TypeError('Manifest is not an array.')
      }
      this.definitions = manifest
      WIKI.logger.info(`Found ${this.definitions.length} blocks [ OK ]`)
    } catch (err: any) {
      this.definitions = []
      WIKI.logger.warn(
        `Could not read the blocks manifest at ${manifestPath} — run "npm run build" in blocks/. [ SKIPPED ]`
      )
      WIKI.logger.warn(err.message)
    }
  }

  /**
   * Register any built-in block missing from a site, and drop rows for built-ins that no longer
   * exist on disk. Existing rows are updated in place so that `isEnabled` and `config` survive.
   *
   * Custom blocks are never touched — they have no on-disk counterpart to compare against.
   */
  async syncSite(siteId: string): Promise<void> {
    const existing = await WIKI.db
      .select({ id: blocksTable.id, block: blocksTable.block })
      .from(blocksTable)
      .where(and(eq(blocksTable.siteId, siteId), eq(blocksTable.isCustom, false)))
    const existingKeys = existing.map((b: any) => b.block)
    const definedKeys = this.definitions.map((d) => d.block)

    for (const definition of this.definitions) {
      if (existingKeys.includes(definition.block)) {
        // -> Metadata may have changed on disk; state and config belong to the site
        await WIKI.db
          .update(blocksTable)
          .set({
            name: definition.name,
            description: definition.description,
            icon: definition.icon
          })
          .where(and(eq(blocksTable.siteId, siteId), eq(blocksTable.block, definition.block)))
      } else {
        await WIKI.db.insert(blocksTable).values({
          siteId,
          block: definition.block,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          isEnabled: true,
          isCustom: false,
          config: {}
        })
      }
    }

    // -> A built-in that has been removed from disk should not linger in the admin list
    const orphaned = existingKeys.filter((key: string) => !definedKeys.includes(key))
    if (orphaned.length > 0) {
      await WIKI.db
        .delete(blocksTable)
        .where(
          and(
            eq(blocksTable.siteId, siteId),
            eq(blocksTable.isCustom, false),
            inArray(blocksTable.block, orphaned)
          )
        )
    }
  }

  /**
   * Register the built-in blocks for every site. Called at boot, after the sites cache is loaded.
   */
  async syncAllSites(): Promise<void> {
    WIKI.logger.info('Registering blocks for all sites...')
    const sites = await WIKI.db.select({ id: sitesTable.id }).from(sitesTable)
    for (const site of sites) {
      await WIKI.models.blocks.syncSite(site.id)
    }
    WIKI.logger.info(`Registered blocks for ${sites.length} sites [ OK ]`)
  }

  /**
   * Fetch the blocks available to a site, built-in first, then by name
   */
  async getSiteBlocks(siteId: string): Promise<SiteBlock[]> {
    const results = await WIKI.db
      .select(blockSelection)
      .from(blocksTable)
      .where(eq(blocksTable.siteId, siteId))
      .orderBy(blocksTable.isCustom, blocksTable.name)
    return results as SiteBlock[]
  }

  /**
   * Enable or disable blocks in bulk.
   *
   * @param states Block IDs with their desired state
   * @returns The number of block rows written — a block already in the requested state still counts
   */
  async setBlocksState(
    siteId: string,
    states: { id: string; isEnabled: boolean }[]
  ): Promise<number> {
    let changed = 0
    for (const isEnabled of [true, false]) {
      const ids = states.filter((s) => s.isEnabled === isEnabled).map((s) => s.id)
      if (ids.length < 1) {
        continue
      }
      const result = await WIKI.db
        .update(blocksTable)
        .set({ isEnabled })
        .where(and(eq(blocksTable.siteId, siteId), inArray(blocksTable.id, ids)))
      changed += result.rowCount ?? 0
    }
    return changed
  }

  /**
   * Delete a custom block. Built-in blocks are rejected, since the next sync would recreate them.
   *
   * @returns Whether a block was deleted
   */
  async deleteCustomBlock(siteId: string, id: string): Promise<boolean> {
    const result = await WIKI.db
      .delete(blocksTable)
      .where(
        and(eq(blocksTable.siteId, siteId), eq(blocksTable.id, id), eq(blocksTable.isCustom, true))
      )
    return (result.rowCount ?? 0) > 0
  }
}

export const blocks = new Blocks()
