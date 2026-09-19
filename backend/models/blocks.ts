import crypto from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, inArray } from 'drizzle-orm'
import { blocks as blocksTable, sites as sitesTable } from '../db/schema.ts'
import { CustomError } from '../helpers/common.ts'
import { readBlockPackage } from '../helpers/wkblock.ts'

/** One authorable attribute of a block, as its `static definition` describes it. */
export interface BlockProp {
  name: string
  /** `icon` is a string holding an Iconify reference, offered with the app's icon picker. */
  type: 'string' | 'number' | 'boolean' | 'select' | 'icon'
  label?: string
  hint?: string
  required?: boolean
  /**
   * The choices a `select` offers.
   *
   * Plain strings where the value IS the wording. An object where they differ -- a tab's header level
   * is offered as "Heading 3" and written as `3`, because `anchorHeadings` accepts a digit and
   * nothing else.
   */
  options?: (string | { label: string; value: string })[]
  default?: string | number | boolean
}

/** A block as declared by its component's `static definition`. */
export interface BlockDefinition {
  block: string
  name: string
  description: string
  icon: string
  props?: BlockProp[]
  /**
   * A block that only ever appears inside another one, such as a single tab of a set of tabs.
   *
   * It is never registered for a site: not something to insert on its own, and not something to
   * switch off separately from its parent. It is still declared here, because that is what lets its
   * tag and attributes survive a page being saved.
   */
  isChild?: boolean
  /** Body the editor writes between the opening and closing lines when inserting the block. */
  template?: string
  /**
   * The same starter body in AsciiDoc, for a block whose template cannot be derived from the markdown
   * one.
   *
   * Absent for almost every block, and absent is a complete answer: a body that is one fenced source
   * is rewritten mechanically, and a body that is plain prose reads identically in both syntaxes.
   * What needs this is a template that spells STRUCTURE — nested blocks, or a list with paragraphs
   * attached to its items — since AsciiDoc writes both differently. See `asciidocTemplate` in
   * `frontend/src/helpers/blocks.js`.
   */
  asciidocTemplate?: string
  /**
   * Names an editor for the block's BODY, which the markdown editor then offers as a second lens
   * above the block — "Edit Content", beside "Edit Block Parameters".
   *
   * For a block whose body is a fenced source the props form has nothing to say about: a diagram, a
   * drawing. The value is a key the frontend resolves to a component, not a component or a URL, so
   * that what a block declares stays a plain literal the manifest can be read out of.
   *
   * Absent for every other block, and absent is the answer: a body nobody named an editor for is
   * edited in the page like any other content.
   */
  contentEditor?: string
}

/** A block row as exposed by the API, with what its component says it can be given. */
export interface SiteBlock {
  id: string
  block: string
  name: string
  description: string
  icon: string
  isEnabled: boolean
  isCustom: boolean
  config: Record<string, any>
  props: BlockProp[]
  template: string
  /** Empty for a block whose starter body needs no AsciiDoc spelling of its own — see the definition. */
  asciidocTemplate: string
  /** Empty for a block that names no body editor, which is most of them. */
  contentEditor: string
  /**
   * Whether this block only ever appears inside another one — `block-tab` inside `block-tabs`.
   *
   * Such a block has no row of its own and nothing to switch on or off: it is available wherever its
   * parent is. It is still listed, because an editor has to be able to build a form for the props it
   * declares, and a caller offering blocks to INSERT is expected to skip it.
   */
  isChild: boolean
}

/**
 * What a block is imported from, and what came of it. The reply to an import.
 */
export interface BlockImportResult {
  id: string
  block: string
  name: string
  /** False when the package replaced a block this site already had — an upgrade rather than a new one. */
  isNew: boolean
  fileCount: number
  /** When the package was built, and by which version of the wiki. Empty if it did not say. */
  packagedAt: string
  packagedWith: string
}

/** Everything `postProcess` needs from this model to decide which block tags survive a save. */
export interface RenderableBlocks {
  /** The keys of the blocks this site has switched on. */
  enabled: Set<string>
  /**
   * The definitions of this site's CUSTOM blocks, which are on nobody's disk to be read from.
   *
   * Read in the same query as the keys above rather than from a cache, for the same reason that
   * query is not cached: a definition this misses is a block stripped out of somebody's page.
   */
  custom: BlockDefinition[]
}

const blockSelection = {
  id: blocksTable.id,
  block: blocksTable.block,
  name: blocksTable.name,
  description: blocksTable.description,
  icon: blocksTable.icon,
  isEnabled: blocksTable.isEnabled,
  isCustom: blocksTable.isCustom,
  config: blocksTable.config,
  definition: blocksTable.definition
}

/**
 * Blocks model
 *
 * Built-in blocks live in the `blocks/` workspace, one directory per block. Their metadata is
 * declared as a `static definition` on each Lit component and collected into
 * `blocks/compiled/blocks.manifest.json` by the rollup build, which is what this model reads —
 * the components themselves cannot be imported outside a browser.
 *
 * A CUSTOM block is the same thing built outside this tree: one block compiled on its own by
 * `blocks/package.mjs` into a `.wkblock` file, uploaded here, and kept in the database. It has no
 * manifest entry and never gets one — its definition is stored on its row, and its compiled files are
 * unpacked into `<dataPath>/cache/blocks` the first time a browser asks for one. See `importPackage`.
 */
class Blocks {
  /** Definitions read from the compiled manifest, refreshed by `refreshFromDisk()`. */
  definitions: BlockDefinition[] = []

  /**
   * Which blocks are custom, per site, and at what version — `siteId` → `block` → checksum.
   *
   * This is what `controllers/blocks.ts` answers a request from, so it has to be reachable without a
   * query: every file of every block on every page goes through it. Filled by `refreshCustomIndex()`
   * at boot and after an import or a delete, and re-read on the `reloadBlocks` event so that the
   * other instances of an HA set find out.
   */
  private customIndex = new Map<string, Map<string, string>>()

  /**
   * The checksum this instance has already unpacked into the cache, keyed `siteId:block`.
   *
   * Just so a warm instance does not stat the cache on every request. The disk is still the authority
   * — this only ever says "no need to look".
   */
  private materialized = new Map<string, string>()

  /** In-flight unpacks, so that a burst of requests for a cold block does not unpack it many times. */
  private materializing = new Map<string, Promise<void>>()

  /**
   * Whether the last read of the manifest succeeded.
   *
   * Told apart from "the manifest lists nothing", because the two mean opposite things to a sync: an
   * empty manifest says every built-in block has been removed, a missing one says nothing at all.
   */
  private manifestLoaded = false

  /**
   * Load the built-in block definitions from the compiled manifest.
   *
   * Read on every boot, so a block whose name, description or icon changed on disk is picked up by
   * restarting the server — `syncAllSites` is what writes the difference to each site.
   *
   * A missing manifest is not fatal: `blocks/compiled` is a build output and is not in the
   * repository, so a fresh checkout has none until `npm run build` has been run in `blocks/`.
   */
  async refreshFromDisk(): Promise<void> {
    const manifestPath = path.join(WIKI.ROOTPATH, 'blocks/compiled/blocks.manifest.json')
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      if (!Array.isArray(manifest)) {
        throw new TypeError('Manifest is not an array.')
      }
      this.definitions = manifest
      this.manifestLoaded = true
      WIKI.logger.info(`Found ${this.definitions.length} blocks [ OK ]`)
      await this.warnIfStale(manifestPath)
    } catch (err: any) {
      this.definitions = []
      this.manifestLoaded = false
      WIKI.logger.warn(
        `Could not read the blocks manifest at ${manifestPath} — run "npm run build" in blocks/. [ SKIPPED ]`
      )
      WIKI.logger.warn(err.message)
    }
  }

  /**
   * Say so when the manifest is older than the components it was built from.
   *
   * The manifest is a build output, and nothing rebuilds it on the way in here — so editing a block
   * and restarting the server looks like the change was ignored, when what happened is that the
   * server read a manifest describing the previous version of the block.
   *
   * Only in a source tree: a packaged instance ships `blocks/compiled` without the sources beside it,
   * where there is nothing to compare against and nothing anybody could rebuild.
   */
  private async warnIfStale(manifestPath: string): Promise<void> {
    try {
      const sourcePath = path.join(WIKI.ROOTPATH, 'blocks')
      const builtAt = (await stat(manifestPath)).mtimeMs
      const entries = await readdir(sourcePath, { withFileTypes: true })
      const stale: string[] = []
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('block-')) {
          continue
        }
        const component = path.join(sourcePath, entry.name, 'component.js')
        const changedAt = await stat(component).then(
          (info) => info.mtimeMs,
          () => 0
        )
        if (changedAt > builtAt) {
          stale.push(entry.name)
        }
      }
      if (stale.length > 0) {
        WIKI.logger.warn(
          `${stale.join(', ')} changed since the blocks manifest was built — run "npm run build" in blocks/ and restart to pick that up.`
        )
      }
    } catch {
      // -> No sources to compare against, which is the normal state of a packaged instance
    }
  }

  /**
   * Bring a site's block rows in line with what is installed on disk.
   *
   * Registers what is missing, writes back a name, description or icon that changed, and drops rows
   * for built-ins that are no longer there. `isEnabled` and `config` are the site's own and are never
   * touched — which is why an existing row is updated rather than replaced.
   *
   * Custom blocks are left alone entirely: they have no on-disk counterpart to compare against.
   *
   * @returns How many rows were added, changed and removed
   */
  async syncSite(siteId: string): Promise<{ added: number; updated: number; removed: number }> {
    const existing = await WIKI.db
      .select({
        block: blocksTable.block,
        name: blocksTable.name,
        description: blocksTable.description,
        icon: blocksTable.icon
      })
      .from(blocksTable)
      .where(and(eq(blocksTable.siteId, siteId), eq(blocksTable.isCustom, false)))
    // -> Child blocks are part of their parent, so they get no row of their own — and a block that
    //    becomes one is cleaned up by the orphan pass below, since it is no longer a defined key
    const registrable = this.definitions.filter((d) => !d.isChild)
    const definedKeys = registrable.map((d) => d.block)
    let added = 0
    let updated = 0

    for (const definition of registrable) {
      const row = existing.find((entry: any) => entry.block === definition.block)
      if (!row) {
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
        added++
        continue
      }
      // -> Written only when it would change something, so that a boot that found nothing new is a
      //    boot that wrote nothing — and the count below means what it says
      if (
        row.name !== definition.name ||
        row.description !== definition.description ||
        row.icon !== definition.icon
      ) {
        await WIKI.db
          .update(blocksTable)
          .set({
            name: definition.name,
            description: definition.description,
            icon: definition.icon
          })
          .where(and(eq(blocksTable.siteId, siteId), eq(blocksTable.block, definition.block)))
        updated++
      }
    }

    // -> A built-in that has been removed from disk should not linger in the admin list
    const orphaned = existing
      .map((entry: any) => entry.block)
      .filter((key: string) => !definedKeys.includes(key))
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

    return { added, updated, removed: orphaned.length }
  }

  /**
   * Register the built-in blocks for every site. Called at boot, after the sites cache is loaded.
   *
   * Skipped outright when the manifest could not be read, rather than run against an empty list of
   * definitions: that would read as "every built-in block has been uninstalled" and delete each
   * site's rows, taking which blocks it had switched on with them.
   */
  async syncAllSites(): Promise<void> {
    if (!this.manifestLoaded) {
      WIKI.logger.warn('Skipping block registration: the manifest could not be read. [ SKIPPED ]')
      return
    }
    WIKI.logger.info('Registering blocks for all sites...')
    const sites = await WIKI.db.select({ id: sitesTable.id }).from(sitesTable)
    const total = { added: 0, updated: 0, removed: 0 }
    for (const site of sites) {
      const counts = await WIKI.models.blocks.syncSite(site.id)
      total.added += counts.added
      total.updated += counts.updated
      total.removed += counts.removed
    }
    WIKI.logger.info(`Registered blocks for ${sites.length} sites [ OK ]`)
    if (total.added || total.updated || total.removed) {
      WIKI.logger.info(
        `Blocks changed on disk: ${total.added} added, ${total.updated} updated, ${total.removed} removed.`
      )
    }
  }

  /**
   * Fetch the blocks available to a site, by name.
   *
   * By name ALONE, rather than built-in blocks and then imported ones: both screens that show this
   * list — the admin area's and the editor's picker — are read to find one block in it, and a reader
   * looking for "Greeter" should not have to know where it came from first. Which of the two a block is
   * is on its own row either way.
   *
   * The child blocks follow at the end, since they are appended below rather than selected. Nothing
   * displays one, so they have no order to be in.
   */
  async getSiteBlocks(siteId: string): Promise<SiteBlock[]> {
    const results = await WIKI.db
      .select(blockSelection)
      .from(blocksTable)
      .where(eq(blocksTable.siteId, siteId))
      .orderBy(blocksTable.name)
    /*
      For a built-in, `props` come from the manifest rather than the row: they describe the component's
      own attributes, so they belong to the installed code and not to a site's copy of it. Reading them
      here means an updated block's props are correct the moment it is deployed, with nothing to
      migrate.

      A custom block has no manifest entry, and its row is where the installed code IS — the definition
      was stored from its package at import, and is replaced whole whenever a newer package is
      uploaded. Same rule, therefore, read from the other place.
    */
    const listed = (results as (SiteBlock & { definition: BlockDefinition })[]).map((stored) => {
      const { definition: storedDefinition, ...row } = stored
      const definition = row.isCustom
        ? storedDefinition
        : this.definitions.find((d) => d.block === row.block)
      return {
        ...row,
        props: definition?.props ?? [],
        template: definition?.template ?? '',
        asciidocTemplate: definition?.asciidocTemplate ?? '',
        contentEditor: definition?.contentEditor ?? '',
        isChild: false
      }
    })

    /*
      And the child blocks, which have no row to have been read above — `registerForSite` skips them,
      because there is nothing about `block-tab` for a site to turn on or off independently of the
      tabset it lives in.
      
      They are listed all the same, because the props they declare are what an editor builds its
      parameters form from: without them, the form for a tab's label, icon and header level cannot be
      built at all, and the button that opens it does nothing. `isChild` is how a caller offering
      blocks to insert knows to leave them out of the list.
    */
    const children = this.definitions
      .filter((definition) => definition.isChild)
      .map((definition) => ({
        id: `child:${definition.block}`,
        block: definition.block,
        name: definition.name,
        description: definition.description,
        icon: definition.icon,
        // -> Available exactly when whatever holds it is, which is not a question this row can answer
        isEnabled: true,
        isCustom: false,
        config: {},
        props: definition.props ?? [],
        template: definition.template ?? '',
        asciidocTemplate: definition.asciidocTemplate ?? '',
        contentEditor: definition.contentEditor ?? '',
        isChild: true
      }))

    return [...listed, ...children]
  }

  /**
   * The blocks a site has switched on, and what the custom ones among them declare.
   *
   * Read from the database on every call rather than kept in a cache like this model's definitions.
   * What this answer gates is which blocks survive a page being saved, and a stale `false` silently
   * strips an author's block out of their page — a wrong answer here destroys content rather than
   * merely showing the wrong list. One indexed read of a handful of rows, on a path that has just
   * sanitised a whole document, is not worth that risk. The custom definitions ride along in the same
   * query for exactly the same reason: a block imported a minute ago on another instance of an HA set
   * must not be stripped out of the first page saved after it.
   *
   * Child blocks never appear: they have no row of their own, and follow the block they sit in.
   */
  async getEnabledForRender(siteId: string): Promise<RenderableBlocks> {
    const rows = await WIKI.db
      .select({
        block: blocksTable.block,
        isCustom: blocksTable.isCustom,
        definition: blocksTable.definition
      })
      .from(blocksTable)
      .where(and(eq(blocksTable.siteId, siteId), eq(blocksTable.isEnabled, true)))
    return {
      enabled: new Set(rows.map((row) => row.block)),
      custom: rows
        .filter((row) => row.isCustom)
        .map((row) => row.definition as BlockDefinition)
        .filter((definition) => definition?.block)
    }
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
    const [deleted] = await WIKI.db
      .delete(blocksTable)
      .where(
        and(eq(blocksTable.siteId, siteId), eq(blocksTable.id, id), eq(blocksTable.isCustom, true))
      )
      .returning({ block: blocksTable.block })
    if (!deleted) {
      return false
    }
    await this.discardCached(siteId, deleted.block)
    await this.refreshCustomIndex()
    WIKI.events.outbound.emit('reloadBlocks')
    return true
  }

  // == CUSTOM BLOCKS ==================

  /** Where unpacked custom blocks live. Derived and disposable — the packages are in the database. */
  get cachePath(): string {
    return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache/blocks')
  }

  /**
   * Install a packaged block on a site, or replace the one already there.
   *
   * Replacing is how a block is upgraded, and is why the row is updated rather than swapped: whether
   * the site has the block switched on, and whatever it has configured on it, are the site's own
   * answers and survive a new package. What the package brings is the code, the definition and the
   * name — the three things that describe the block itself.
   *
   * The key is the identity. A package whose key is that of a built-in block is refused rather than
   * shadowing it: the two would be served from the same URL, and one of them would silently win.
   */
  async importPackage(siteId: string, data: Buffer): Promise<BlockImportResult> {
    const pkg = readBlockPackage(data)

    if (this.definitions.some((definition) => definition.block === pkg.block)) {
      throw new CustomError(
        'blockPackageConflict',
        `This wiki already has a built-in block called "${pkg.block}", and both would be served from the same address. Rename the block and package it again.`,
        409
      )
    }

    const [existing] = await WIKI.db
      .select({ id: blocksTable.id, isCustom: blocksTable.isCustom })
      .from(blocksTable)
      .where(and(eq(blocksTable.siteId, siteId), eq(blocksTable.block, pkg.block)))
    if (existing && !existing.isCustom) {
      throw new CustomError(
        'blockPackageConflict',
        `This site already has a built-in block called "${pkg.block}".`,
        409
      )
    }

    const checksum = crypto.createHash('sha256').update(data).digest('hex')
    const values = {
      name: pkg.definition.name,
      description: pkg.definition.description,
      icon: pkg.definition.icon,
      definition: pkg.definition,
      packageData: data,
      checksum
    }

    let id: string
    if (existing) {
      await WIKI.db.update(blocksTable).set(values).where(eq(blocksTable.id, existing.id))
      id = existing.id
    } else {
      const [inserted] = await WIKI.db
        .insert(blocksTable)
        .values({
          ...values,
          siteId,
          block: pkg.block,
          isEnabled: true,
          isCustom: true,
          config: {}
        })
        .returning({ id: blocksTable.id })
      id = inserted.id
    }

    /*
      The files are not written here. `materialize` unpacks them from the row on the first request, so
      an upgrade lands on every instance of an HA set on its own — including one that was not running
      when the upload happened. All this has to do is make sure nothing stale is left behind on THIS
      instance, and tell the others to re-read the index.
    */
    await this.discardCached(siteId, pkg.block)
    await this.refreshCustomIndex()
    WIKI.events.outbound.emit('reloadBlocks')

    WIKI.logger.info(`Imported block ${pkg.block} (${pkg.files.size} file(s)) into site ${siteId}.`)
    return {
      id,
      block: pkg.block,
      name: pkg.definition.name,
      isNew: !existing,
      fileCount: pkg.files.size,
      packagedAt: pkg.packagedAt,
      packagedWith: pkg.packagedWith
    }
  }

  /**
   * Re-read which blocks are custom, on every site.
   *
   * Cheap — three small columns and no package bytes — and it is the only thing the serving route
   * consults per request.
   */
  async refreshCustomIndex(): Promise<void> {
    const rows = await WIKI.db
      .select({
        siteId: blocksTable.siteId,
        block: blocksTable.block,
        checksum: blocksTable.checksum
      })
      .from(blocksTable)
      .where(eq(blocksTable.isCustom, true))
    const index = new Map<string, Map<string, string>>()
    for (const row of rows) {
      const forSite = index.get(row.siteId) ?? new Map<string, string>()
      forSite.set(row.block, row.checksum)
      index.set(row.siteId, forSite)
    }
    this.customIndex = index
  }

  /**
   * The directory a custom block's files are served from, unpacking them first if need be.
   *
   * Null when this site has no custom block by that key, which is the ordinary answer — every request
   * for a built-in block asks this first.
   */
  async servingPathFor(siteId: string, block: string): Promise<string | null> {
    const checksum = this.customIndex.get(siteId)?.get(block)
    if (!checksum) {
      return null
    }
    const key = `${siteId}:${block}`
    if (this.materialized.get(key) !== checksum) {
      let pending = this.materializing.get(key)
      if (!pending) {
        pending = this.materialize(siteId, block, checksum).finally(() => {
          this.materializing.delete(key)
        })
        this.materializing.set(key, pending)
      }
      await pending
    }
    return path.join(this.cachePath, siteId, `block-${block}`)
  }

  /**
   * Unpack a custom block's package into the cache, unless it is already there at this version.
   *
   * The marker file beside the directory is what says which version that is, and it is written last —
   * so an unpack that died halfway leaves no marker, and the next request does it again rather than
   * serving half a block. The directory is built under a temporary name and moved into place for the
   * same reason: a request arriving mid-unpack sees the previous version or nothing, never a mixture.
   */
  private async materialize(siteId: string, block: string, checksum: string): Promise<void> {
    const siteDir = path.join(this.cachePath, siteId)
    const blockDir = path.join(siteDir, `block-${block}`)
    const markerPath = `${blockDir}.checksum`
    const key = `${siteId}:${block}`

    if (
      await readFile(markerPath, 'utf8').then(
        (value) => value === checksum,
        () => false
      )
    ) {
      this.materialized.set(key, checksum)
      return
    }

    const [row] = await WIKI.db
      .select({ packageData: blocksTable.packageData })
      .from(blocksTable)
      .where(and(eq(blocksTable.siteId, siteId), eq(blocksTable.block, block)))
    if (!row?.packageData) {
      throw new Error(`Block ${block} has no stored package to unpack.`)
    }
    const pkg = readBlockPackage(Buffer.from(row.packageData))

    const stagingDir = `${blockDir}.${crypto.randomBytes(6).toString('hex')}`
    try {
      for (const [filePath, bytes] of pkg.files) {
        const target = path.join(stagingDir, filePath)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, bytes)
      }
      await rm(blockDir, { recursive: true, force: true })
      await rename(stagingDir, blockDir)
      await writeFile(markerPath, checksum, 'utf8')
    } catch (err) {
      await rm(stagingDir, { recursive: true, force: true })
      throw err
    }
    this.materialized.set(key, checksum)
    WIKI.logger.debug(`Unpacked block ${block} for site ${siteId} into the block cache.`)
  }

  /** Throw away one block's unpacked files, so that the next request writes them again. */
  private async discardCached(siteId: string, block: string): Promise<void> {
    const blockDir = path.join(this.cachePath, siteId, `block-${block}`)
    this.materialized.delete(`${siteId}:${block}`)
    await rm(`${blockDir}.checksum`, { force: true })
    await rm(blockDir, { recursive: true, force: true })
  }

  /**
   * Throw away every unpacked block, for `flushCaches`.
   *
   * Nothing is lost: the packages are rows, and the next request for each block writes its files back.
   */
  async purgeCache(): Promise<void> {
    this.materialized.clear()
    await rm(this.cachePath, { recursive: true, force: true })
  }
}

export const blocks = new Blocks()
