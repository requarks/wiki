import fs from 'node:fs/promises'
import path from 'node:path'
import { and, count, eq, inArray } from 'drizzle-orm'
import { getIconData, iconToHTML, iconToSVG, replaceIDs } from '@iconify/utils'
import { icons as iconsTable, iconSets as iconSetsTable } from '../db/schema.ts'
import type { IconifyIconCustomisations } from '@iconify/utils'
import type { IconifyIcon, IconifyInfo, IconifyJSON } from '@iconify/types'

/** An icon set as stored, plus how many of its icons the wiki holds. */
export interface IconSet {
  prefix: string
  name: string
  isEnabled: boolean
  info: IconifyInfo | Record<string, never>
  refreshedAt: Date | null
  createdAt: Date
  /** Icons of this set stored in the database, i.e. the ones this wiki can serve on its own. */
  iconCount: number
}

/** An icon set offered by the upstream API but not added here yet. */
export interface AvailableIconSet {
  prefix: string
  name: string
  total: number
  author: string
  license: string
  category: string
  /** Whether the set's icons carry their own colors, i.e. cannot be recolored with `currentColor`. */
  palette: boolean
  samples: string[]
  isAdded: boolean
}

/** The result of a resolve, in the shape the Iconify API protocol expects. */
export interface ResolvedIcons {
  icons: Record<string, IconifyIcon>
  notFound: string[]
}

/**
 * Icon sets seeded on a fresh instance, so that the picker is usable before an administrator has
 * added anything. The names are the upstream ones and get overwritten by the first metadata refresh.
 */
const DEFAULT_SETS: { prefix: string; name: string }[] = [
  { prefix: 'mdi', name: 'Material Design Icons' },
  { prefix: 'la', name: 'Line Awesome' }
]

/** Iconify prefixes and icon names are lowercase, dash-separated words. */
const PREFIX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NAME_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/

/** How many resolved icons to hold per instance. An icon body is ~1 kB, so this is a few MB. */
const MEMORY_CACHE_MAX = 2000

/** How long the upstream collection list and per-set icon lists stay memoized. */
const CATALOG_TTL_MS = 60 * 60 * 1000

/**
 * Ceiling on upstream requests per minute, across every caller.
 *
 * The public icon route fills the cache on a miss, and it is reachable by anyone who can read a page.
 * Without a ceiling, a stream of requests for icons that do not exist would be amplified into a
 * stream of requests to the Iconify API. Icons already stored are unaffected — they never go upstream.
 */
const UPSTREAM_BUDGET_PER_MINUTE = 60

/** How long a name that upstream does not know stays remembered as missing. */
const NOT_FOUND_TTL_MS = 60 * 60 * 1000

/**
 * Reject anything that could execute when an icon is opened directly rather than drawn into a page.
 *
 * Icon bodies come from a third-party API, and while Iconify publishes shape markup, a compromised or
 * misconfigured upstream is exactly the case worth being defensive about. Nothing legitimate in an
 * icon body needs a script, an event handler or an external reference.
 */
function isSafeIconBody(body: string): boolean {
  return !/<script|<foreignobject|<iframe|<use[^>]+href\s*=\s*["']?https?:|\son\w+\s*=|javascript:/i.test(
    body
  )
}

/**
 * Icons model
 *
 * Icons are addressed the way Iconify addresses them — `<prefix>:<name>`, e.g. `mdi:account-edit` —
 * and that reference is all content ever stores. Resolving one to markup goes through four tiers:
 *
 * 1. **memory**, per instance, for the icons a page is actually made of
 * 2. **disk**, under `<dataPath>/cache/icons`, one small JSON file per icon
 * 3. **the database**, the permanent record: every icon the wiki has ever served lives here, so a new
 *    instance with an empty disk (or an instance with no outbound network at all) serves everything
 *    that content references
 * 4. **the Iconify API**, consulted only for an icon nobody has used yet, and then persisted
 *
 * Rendering a page never resolves an icon: the page carries names, the browser asks for the icons it
 * needs in one batch, and those answers are cached hard by the browser. Serving them touches the
 * database only for an icon that is neither in memory nor on disk — so on a warm instance, never.
 */
class Icons {
  /** Resolved icon data, keyed `prefix:name`. Insertion-ordered, so the oldest entry is evictable. */
  memoryCache = new Map<string, IconifyIcon>()

  /** Names upstream has no icon for, keyed `prefix:name` with the time they were last looked up. */
  notFoundCache = new Map<string, number>()

  /** Upstream catalog responses, memoized to keep the admin area and the picker snappy. */
  catalogCache = new Map<string, { fetchedAt: number; data: any }>()

  /** Rolling count of upstream requests, for `UPSTREAM_BUDGET_PER_MINUTE`. */
  upstreamBudget = { windowStartedAt: 0, used: 0 }

  get cachePath(): string {
    return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache/icons')
  }

  get apiUrl(): string {
    return WIKI.config.icons?.apiUrl || 'https://api.iconify.design'
  }

  /**
   * Split a `prefix:name` reference, or null when it is not one
   */
  parseRef(ref: string): { prefix: string; name: string } | null {
    const [prefix, name, ...rest] = `${ref}`.toLowerCase().split(':')
    if (!prefix || !name || rest.length > 0) {
      return null
    }
    return this.isValidRef(prefix, name) ? { prefix, name } : null
  }

  /**
   * Whether a prefix and name are shaped like Iconify identifiers.
   *
   * Both end up in a file path, so this is what keeps `../` and friends out of the disk cache.
   */
  isValidRef(prefix: string, name: string): boolean {
    return PREFIX_PATTERN.test(prefix) && NAME_PATTERN.test(name)
  }

  // == SETS ===========================

  /**
   * Every added icon set, alphabetically, with the number of icons stored for each
   */
  async getSets(): Promise<IconSet[]> {
    const sets = await WIKI.db.select().from(iconSetsTable).orderBy(iconSetsTable.name)
    const counts = await WIKI.db
      .select({ prefix: iconsTable.prefix, total: count() })
      .from(iconsTable)
      .groupBy(iconsTable.prefix)
    return sets.map((set) => ({
      ...set,
      info: (set.info ?? {}) as IconifyInfo,
      iconCount: counts.find((c) => c.prefix === set.prefix)?.total ?? 0
    })) as IconSet[]
  }

  /**
   * A single set, or null when it has not been added
   */
  async getSet(prefix: string): Promise<IconSet | null> {
    return (await this.getSets()).find((set) => set.prefix === prefix) ?? null
  }

  /**
   * The prefixes of the sets icons may currently be drawn from
   */
  async getEnabledPrefixes(): Promise<string[]> {
    const sets = await WIKI.db
      .select({ prefix: iconSetsTable.prefix })
      .from(iconSetsTable)
      .where(eq(iconSetsTable.isEnabled, true))
    return sets.map((s) => s.prefix)
  }

  /**
   * Add an icon set, taking its name and metadata from upstream.
   *
   * @returns The set as added
   * @throws When the prefix is malformed, already added, or unknown upstream
   */
  async addSet(prefix: string): Promise<IconSet> {
    if (!PREFIX_PATTERN.test(prefix)) {
      return Promise.reject(new Error(`"${prefix}" is not a valid icon set prefix.`))
    }
    if (await this.getSet(prefix)) {
      return Promise.reject(new Error(`The ${prefix} icon set has already been added.`))
    }
    const collections = await this.getCollections()
    const info = collections[prefix]
    if (!info) {
      return Promise.reject(new Error(`There is no "${prefix}" icon set available upstream.`))
    }

    await WIKI.db.insert(iconSetsTable).values({
      prefix,
      name: info.name ?? prefix,
      isEnabled: true,
      info,
      refreshedAt: new Date()
    })
    WIKI.logger.info(`Added icon set ${prefix} [ OK ]`)
    return (await this.getSet(prefix))!
  }

  /**
   * Enable or disable an icon set.
   *
   * A disabled set stops being searchable and stops being filled from upstream, but the icons already
   * stored for it keep being served: content referencing them is already published, and answering
   * those requests with nothing would silently break pages.
   *
   * @returns Whether the set was updated
   */
  async setSetState(prefix: string, isEnabled: boolean): Promise<boolean> {
    const result = await WIKI.db
      .update(iconSetsTable)
      .set({ isEnabled })
      .where(eq(iconSetsTable.prefix, prefix))
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Delete an icon set along with every icon stored for it, and drop its disk cache.
   *
   * Content referencing those icons will stop rendering them, which is why the admin area asks first.
   *
   * @returns How many stored icons went with it
   */
  async deleteSet(prefix: string): Promise<number> {
    const deletedIcons = await WIKI.db.delete(iconsTable).where(eq(iconsTable.prefix, prefix))
    await WIKI.db.delete(iconSetsTable).where(eq(iconSetsTable.prefix, prefix))

    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${prefix}:`)) {
        this.memoryCache.delete(key)
      }
    }
    await fs.rm(path.join(this.cachePath, prefix), { recursive: true, force: true })

    WIKI.logger.info(`Deleted icon set ${prefix} [ OK ]`)
    return deletedIcons.rowCount ?? 0
  }

  /**
   * Re-read the metadata of every added set from upstream.
   *
   * Only the description of a set changes here — its icons are untouched.
   *
   * @returns How many sets were refreshed
   */
  async refreshSets(): Promise<number> {
    const collections = await this.getCollections()
    const sets = await WIKI.db.select({ prefix: iconSetsTable.prefix }).from(iconSetsTable)
    let refreshed = 0
    for (const set of sets) {
      const info = collections[set.prefix]
      if (!info) {
        // -> A set can be renamed or withdrawn upstream. Keeping the row is the right call: its icons
        //    are stored here and content still references them.
        WIKI.logger.warn(`Icon set ${set.prefix} is no longer offered upstream [ SKIPPED ]`)
        continue
      }
      await WIKI.db
        .update(iconSetsTable)
        .set({ name: info.name ?? set.prefix, info, refreshedAt: new Date() })
        .where(eq(iconSetsTable.prefix, set.prefix))
      refreshed++
    }
    return refreshed
  }

  // == UPSTREAM CATALOG ===============

  /**
   * Every icon set the upstream API offers, keyed by prefix
   */
  async getCollections(): Promise<Record<string, IconifyInfo>> {
    return this.fetchCatalog('collections', '/collections')
  }

  /**
   * The upstream catalog as the admin area lists it, marking the sets already added
   */
  async getAvailableSets(): Promise<AvailableIconSet[]> {
    const [collections, added] = await Promise.all([
      this.getCollections(),
      WIKI.db.select({ prefix: iconSetsTable.prefix }).from(iconSetsTable)
    ])
    const addedPrefixes = added.map((s) => s.prefix)
    return Object.entries(collections)
      .map(([prefix, info]) => ({
        prefix,
        name: info.name ?? prefix,
        total: info.total ?? 0,
        author: info.author?.name ?? '',
        license: info.license?.title ?? '',
        category: info.category ?? '',
        palette: info.palette === true,
        samples: info.samples ?? [],
        isAdded: addedPrefixes.includes(prefix)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * The names of every icon in a set, for browsing it without a search term.
   *
   * @throws When the set has not been added or is disabled
   */
  async listSetIcons(prefix: string): Promise<string[]> {
    const set = await this.getSet(prefix)
    if (!set?.isEnabled) {
      return Promise.reject(new Error(`The ${prefix} icon set is not available.`))
    }
    const collection = await this.fetchCatalog(
      `collection:${prefix}`,
      `/collection?prefix=${encodeURIComponent(prefix)}`
    )
    // -> Icons come either grouped in categories or as a flat `uncategorized` list, and a set can use
    //    both. Hidden icons are deprecated ones kept for compatibility, so they are left out.
    const categorized = Object.values(
      (collection.categories ?? {}) as Record<string, string[]>
    ).flat()
    const names = [...categorized, ...((collection.uncategorized ?? []) as string[])]
    return [...new Set(names)].sort()
  }

  /**
   * Search icons upstream, within the sets that are enabled here.
   *
   * @returns References shaped `prefix:name`
   */
  async searchIcons({
    query,
    prefixes,
    limit = 96
  }: {
    query: string
    prefixes?: string[]
    limit?: number
  }): Promise<string[]> {
    const enabled = await this.getEnabledPrefixes()
    // -> Searching a disabled set would offer icons that cannot then be stored
    const searchIn = prefixes?.length ? prefixes.filter((p) => enabled.includes(p)) : enabled
    if (searchIn.length < 1) {
      return []
    }
    const params = new URLSearchParams({
      query,
      limit: `${Math.min(Math.max(limit, 32), 999)}`,
      prefixes: searchIn.join(',')
    })
    const result = await this.apiFetch(`/search?${params}`)
    return (result.icons ?? []) as string[]
  }

  /**
   * Fetch an upstream catalog response, memoized for `CATALOG_TTL_MS`.
   *
   * These are large and change rarely, whereas the admin area and the picker ask for them often.
   */
  async fetchCatalog(key: string, pathname: string): Promise<any> {
    const cached = this.catalogCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) {
      return cached.data
    }
    const data = await this.apiFetch(pathname)
    this.catalogCache.set(key, { fetchedAt: Date.now(), data })
    return data
  }

  // == RESOLVING ======================

  /**
   * Resolve icons of one set, filling the cache from upstream for any the wiki does not hold yet.
   *
   * @param allowUpstream Whether a miss may be fetched upstream. False for callers that must not
   *   cause outbound traffic, e.g. a bulk render.
   */
  async resolveIcons(
    prefix: string,
    names: string[],
    { allowUpstream = true }: { allowUpstream?: boolean } = {}
  ): Promise<ResolvedIcons> {
    const wanted = [...new Set(names)].filter((name) => this.isValidRef(prefix, name))
    const icons: Record<string, IconifyIcon> = {}
    const missing: string[] = []

    // -> Memory first: the icons a page is made of are asked for again and again
    for (const name of wanted) {
      const cached = this.memoryCache.get(`${prefix}:${name}`)
      if (cached) {
        icons[name] = cached
      } else {
        missing.push(name)
      }
    }
    if (missing.length < 1) {
      return { icons, notFound: [] }
    }

    // -> Then disk, which survives a restart and is what keeps page views off the database
    const stillMissingAfterDisk: string[] = []
    for (const name of missing) {
      const cached = await this.readDiskCache(prefix, name)
      if (cached) {
        this.remember(prefix, name, cached)
        icons[name] = cached
      } else {
        stillMissingAfterDisk.push(name)
      }
    }
    if (stillMissingAfterDisk.length < 1) {
      return { icons, notFound: [] }
    }

    // -> Then the permanent record, in one query for everything still missing
    const rows = await WIKI.db
      .select()
      .from(iconsTable)
      .where(and(eq(iconsTable.prefix, prefix), inArray(iconsTable.name, stillMissingAfterDisk)))
    for (const row of rows) {
      const icon = this.rowToIcon(row)
      this.remember(prefix, row.name, icon)
      await this.writeDiskCache(prefix, row.name, icon)
      icons[row.name] = icon
    }

    const stillMissing = stillMissingAfterDisk.filter((name) => !(name in icons))
    if (stillMissing.length < 1) {
      return { icons, notFound: [] }
    }
    if (!allowUpstream) {
      return { icons, notFound: stillMissing }
    }

    const fetched = await this.fetchIconsUpstream(prefix, stillMissing)
    return {
      icons: { ...icons, ...fetched.icons },
      notFound: fetched.notFound
    }
  }

  /**
   * Fetch icons from upstream and store them permanently.
   *
   * Refuses for a set that is not enabled, so that a disabled set cannot grow, and holds to the
   * upstream budget so that requests for icons that do not exist cannot be amplified.
   */
  async fetchIconsUpstream(prefix: string, names: string[]): Promise<ResolvedIcons> {
    const set = await this.getSet(prefix)
    if (!set?.isEnabled) {
      return { icons: {}, notFound: names }
    }

    // -> A name upstream has already denied is not worth asking about again
    const asking = names.filter((name) => !this.isKnownMissing(prefix, name))
    if (asking.length < 1) {
      return { icons: {}, notFound: names }
    }
    if (!this.claimUpstreamBudget()) {
      WIKI.logger.warn(
        `Upstream icon request budget exhausted, not fetching ${prefix}:${asking.join(',')} [ SKIPPED ]`
      )
      return { icons: {}, notFound: names }
    }

    let iconSet: IconifyJSON
    try {
      iconSet = (await this.apiFetch(
        `/${prefix}.json?icons=${asking.map(encodeURIComponent).join(',')}`
      )) as IconifyJSON
    } catch (err: any) {
      WIKI.logger.warn(`Could not fetch icons from ${this.apiUrl} [ FAILED ]`)
      WIKI.logger.warn(err.message)
      return { icons: {}, notFound: names }
    }

    const icons: Record<string, IconifyIcon> = {}
    const notFound: string[] = []
    for (const name of asking) {
      // -> Resolves aliases, character references and set-level defaults into one self-contained icon
      const data = getIconData(iconSet, name)
      if (!data?.body) {
        notFound.push(name)
        this.notFoundCache.set(`${prefix}:${name}`, Date.now())
        continue
      }
      if (!isSafeIconBody(data.body)) {
        notFound.push(name)
        WIKI.logger.warn(`Refused unsafe icon body for ${prefix}:${name} [ FAILED ]`)
        continue
      }
      icons[name] = data
      await this.storeIcon(prefix, name, data)
      await this.writeDiskCache(prefix, name, data)
      this.remember(prefix, name, data)
    }

    if (Object.keys(icons).length > 0) {
      WIKI.logger.debug(`Stored ${Object.keys(icons).length} new icons for set ${prefix} [ OK ]`)
    }
    return { icons, notFound: [...notFound, ...names.filter((n) => !asking.includes(n))] }
  }

  /**
   * Write an icon to the permanent record
   */
  async storeIcon(prefix: string, name: string, icon: IconifyIcon): Promise<void> {
    const values = {
      prefix,
      name,
      body: icon.body,
      width: icon.width ?? 16,
      height: icon.height ?? 16,
      left: icon.left ?? 0,
      top: icon.top ?? 0,
      rotate: icon.rotate ?? 0,
      hFlip: icon.hFlip ?? false,
      vFlip: icon.vFlip ?? false
    }
    await WIKI.db
      .insert(iconsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [iconsTable.prefix, iconsTable.name],
        set: values
      })
  }

  /**
   * Materialize icons so the wiki can serve them without the upstream API.
   *
   * Called when an icon is picked, i.e. while the author is online and before anyone else needs it.
   *
   * @param refs References shaped `prefix:name`
   * @returns The references that could not be stored
   */
  async materializeIcons(refs: string[]): Promise<string[]> {
    const byPrefix = new Map<string, string[]>()
    const invalid: string[] = []
    for (const ref of refs) {
      const parsed = this.parseRef(ref)
      if (!parsed) {
        invalid.push(ref)
        continue
      }
      byPrefix.set(parsed.prefix, [...(byPrefix.get(parsed.prefix) ?? []), parsed.name])
    }

    const failed = [...invalid]
    for (const [prefix, names] of byPrefix) {
      const result = await this.resolveIcons(prefix, names)
      failed.push(...result.notFound.map((name) => `${prefix}:${name}`))
    }
    return failed
  }

  /**
   * The SVG for one icon, for the callers that can only carry a URL — an `<img>`, a CSS background.
   *
   * @returns The SVG markup, or null when there is no such icon
   */
  async getIconSvg(
    prefix: string,
    name: string,
    { allowUpstream = true }: { allowUpstream?: boolean } = {}
  ): Promise<string | null> {
    const resolved = await this.resolveIcons(prefix, [name], { allowUpstream })
    const icon = resolved.icons[name]
    return icon ? this.renderSvg(icon) : null
  }

  /**
   * Turn resolved icon data into standalone SVG markup.
   *
   * Sized in pixels rather than the `1em` Iconify defaults to, since this file is also used as a plain
   * image — an `<img>` has no font size to scale against.
   */
  renderSvg(icon: IconifyIcon): string {
    const rendered = iconToSVG(icon, {
      width: `${icon.width ?? 16}`,
      height: `${icon.height ?? 16}`
    })
    return iconToHTML(rendered.body, rendered.attributes)
  }

  /**
   * Turn resolved icon data into SVG markup to be drawn INTO a document.
   *
   * Sized in `em` — Iconify's default when neither dimension is given — so the icon follows the text
   * it sits in, and painted in `currentColor` by the body itself, so it follows that text's colour.
   *
   * `replaceIDs` is what makes it safe to have more than one on a page: an icon that masks or
   * gradients refers to its own `<defs>` by id, those ids come from the set rather than from this
   * document, and two icons carrying the same one would each draw with whichever won. A standalone
   * file has no such problem, which is why `renderSvg` does not do this.
   */
  renderInlineSvg(icon: IconifyIcon, customisations: IconifyIconCustomisations = {}): string {
    const rendered = iconToSVG(icon, customisations)
    return iconToHTML(replaceIDs(rendered.body), rendered.attributes)
  }

  // == CACHE ==========================

  /**
   * Hold an icon in memory, evicting the least recently stored one when full
   */
  remember(prefix: string, name: string, icon: IconifyIcon): void {
    if (this.memoryCache.size >= MEMORY_CACHE_MAX) {
      const oldest = this.memoryCache.keys().next().value
      if (oldest) {
        this.memoryCache.delete(oldest)
      }
    }
    this.memoryCache.set(`${prefix}:${name}`, icon)
  }

  /**
   * Whether upstream said recently that it has no such icon
   */
  isKnownMissing(prefix: string, name: string): boolean {
    const at = this.notFoundCache.get(`${prefix}:${name}`)
    if (at === undefined) {
      return false
    }
    if (Date.now() - at > NOT_FOUND_TTL_MS) {
      this.notFoundCache.delete(`${prefix}:${name}`)
      return false
    }
    return true
  }

  /**
   * Take one slot from the per-minute upstream allowance
   *
   * @returns Whether the request may go ahead
   */
  claimUpstreamBudget(): boolean {
    const now = Date.now()
    if (now - this.upstreamBudget.windowStartedAt > 60_000) {
      this.upstreamBudget = { windowStartedAt: now, used: 0 }
    }
    if (this.upstreamBudget.used >= UPSTREAM_BUDGET_PER_MINUTE) {
      return false
    }
    this.upstreamBudget.used++
    return true
  }

  /**
   * Where an icon sits in the disk cache.
   *
   * Icon data rather than rendered SVG, so that one cached file answers both the batch data requests
   * the frontend makes and the SVG requests an `<img>` makes — rendering from data is string building.
   */
  diskCachePath(prefix: string, name: string): string {
    return path.join(this.cachePath, prefix, `${name}.json`)
  }

  /**
   * Read an icon from the disk cache
   *
   * @returns The icon, or null when it is not cached or the file is unusable
   */
  async readDiskCache(prefix: string, name: string): Promise<IconifyIcon | null> {
    try {
      const icon = JSON.parse(await fs.readFile(this.diskCachePath(prefix, name), 'utf8'))
      return typeof icon?.body === 'string' ? icon : null
    } catch {
      // -> Not cached on this instance yet, which is the normal state of a fresh container. A corrupt
      //    file lands here too and is treated the same way: refill it from the database.
      return null
    }
  }

  /**
   * Write an icon to the disk cache, best effort.
   *
   * A full or read-only disk must not stop an icon from being served, hence the swallowed error: the
   * cache is derived data and every request can be answered without it.
   *
   * The file is written under a temporary name and renamed, so that a concurrent reader either sees
   * the previous file or the complete new one, never a half-written one.
   */
  async writeDiskCache(prefix: string, name: string, icon: IconifyIcon): Promise<void> {
    const filePath = this.diskCachePath(prefix, name)
    const tempPath = `${filePath}.${process.pid}.tmp`
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(tempPath, JSON.stringify(icon), 'utf8')
      await fs.rename(tempPath, filePath)
    } catch (err: any) {
      WIKI.logger.warn(`Could not write ${filePath} to the icon cache [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
      await fs.rm(tempPath, { force: true }).catch(() => {})
    }
  }

  /**
   * Drop the disk and memory caches. Nothing is lost: both are rebuilt from the database on demand.
   */
  async purgeCache(): Promise<void> {
    this.memoryCache.clear()
    this.notFoundCache.clear()
    this.catalogCache.clear()
    await fs.rm(this.cachePath, { recursive: true, force: true })
    await fs.mkdir(this.cachePath, { recursive: true })
    WIKI.logger.info('Purged the icon cache [ OK ]')
  }

  /**
   * What the wiki holds and what it has cached, for the admin area
   */
  async getStats(): Promise<{
    setCount: number
    enabledSetCount: number
    iconCount: number
    memoryCount: number
    diskCount: number
    diskSize: number
  }> {
    const [sets, iconCount] = await Promise.all([
      WIKI.db.select({ isEnabled: iconSetsTable.isEnabled }).from(iconSetsTable),
      WIKI.db.$count(iconsTable)
    ])
    const disk = await this.measureDiskCache()
    return {
      setCount: sets.length,
      enabledSetCount: sets.filter((s) => s.isEnabled).length,
      iconCount,
      memoryCount: this.memoryCache.size,
      diskCount: disk.files,
      diskSize: disk.bytes
    }
  }

  /**
   * Walk the disk cache. Cheap enough to do on demand: it holds one small file per icon in use.
   */
  async measureDiskCache(): Promise<{ files: number; bytes: number }> {
    let files = 0
    let bytes = 0
    try {
      const entries = await fs.readdir(this.cachePath, { recursive: true, withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue
        }
        files++
        bytes += (await fs.stat(path.join(entry.parentPath, entry.name))).size
      }
    } catch {
      // -> No cache directory yet, which is simply an empty cache
    }
    return { files, bytes }
  }

  // == PLUMBING =======================

  /**
   * Call the upstream Iconify API
   *
   * @throws When offline mode is on, the request fails, or the response is not JSON
   */
  async apiFetch(pathname: string): Promise<any> {
    if (WIKI.config.offline) {
      return Promise.reject(
        new Error('Wiki.js is in offline mode and cannot reach the Iconify API.')
      )
    }
    const url = `${this.apiUrl}${pathname}`
    WIKI.logger.debug(`Fetching ${url}`)
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000)
    })
    if (!resp.ok) {
      return Promise.reject(new Error(`${this.apiUrl} answered ${resp.status} for ${pathname}`))
    }
    const data = await resp.json()
    // -> The API answers an unknown prefix with the string `404` and a 200 status
    if (typeof data !== 'object' || data === null) {
      return Promise.reject(new Error(`${this.apiUrl} has nothing for ${pathname}`))
    }
    return data
  }

  rowToIcon(row: typeof iconsTable.$inferSelect): IconifyIcon {
    return {
      body: row.body,
      width: row.width,
      height: row.height,
      left: row.left,
      top: row.top,
      rotate: row.rotate,
      hFlip: row.hFlip,
      vFlip: row.vFlip
    }
  }

  /**
   * Make sure the cache directory exists, so that the first icon request is not the one to find out
   */
  async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cachePath, { recursive: true })
    } catch (err: any) {
      WIKI.logger.warn(`Could not create the icon cache directory ${this.cachePath} [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
    }
  }

  /**
   * Seed the icon sets a fresh instance starts with.
   *
   * Deliberately network-free: the wiki has to install without outbound access, so only the prefix and
   * a name go in, and the metadata is filled in by the first refresh.
   */
  async init(): Promise<void> {
    WIKI.logger.info('Inserting default icon sets...')
    await WIKI.db
      .insert(iconSetsTable)
      .values(DEFAULT_SETS.map((set) => ({ ...set, isEnabled: true })))
  }
}

export const icons = new Icons()
