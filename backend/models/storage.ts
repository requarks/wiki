import fs from 'node:fs/promises'
import path from 'node:path'
import { load } from 'js-yaml'
import { and, eq, inArray } from 'drizzle-orm'
import { parseModuleProps } from '../helpers/common.ts'
import { sites as sitesTable, storage as storageTable } from '../db/schema.ts'
import type { ModuleProp } from '../helpers/common.ts'
import type { AssetKind } from './assets.ts'

/** The kinds of content a target can be asked to hold. */
export const CONTENT_TYPES = ['pages', 'images', 'documents', 'others', 'large'] as const

export type ContentType = (typeof CONTENT_TYPES)[number]

/**
 * The module every site stores its content in, and the only one that is guaranteed to work: assets
 * and pages live in the wiki database. It cannot be disabled, as that would leave content nowhere.
 */
const DB_MODULE = 'db'

/** Which content type an asset falls into when it is not large enough to count as a large file. */
const CONTENT_TYPE_BY_KIND: Record<AssetKind, ContentType> = {
  image: 'images',
  document: 'documents',
  other: 'others'
}

/**
 * What counts as a large file on a site that has never said.
 *
 * The site's own value lives in its config rather than on a target, because "large" has to mean the
 * same thing everywhere for the routing to be coherent: a file the disk target considers large and
 * the database does not would be claimed by neither, or by both.
 */
const DEFAULT_LARGE_THRESHOLD = '25MB'

/** Bytes in each unit a size threshold may be written with. See `parseSize`. */
const SIZE_UNIT_BYTES: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4
}

/**
 * How long the configured targets of a site are trusted before they are read again.
 *
 * The backstop rather than the mechanism: saving the admin form drops the entry on the instance that
 * handled the request, but a second instance has no way to hear about it — so every entry expires on
 * its own as well. Short enough that a change made elsewhere takes effect promptly, long enough that
 * a burst of uploads resolves its target once rather than once per file.
 */
const TARGET_CACHE_TTL_MS = 30_000

/** An action a module knows how to run on demand, as declared by its `definition.yml`. */
/**
 * How a target is behaving, as opposed to how it is configured.
 *
 * `healthy` covers both "working" and "has not been asked to do anything yet". `error` is an
 * operation that failed and was reported to whoever asked — an upload refused. `warning` is one that
 * failed and was *not*: a page copy that could not be written, a file that could not be deleted. The
 * wiki carries on in that case, which is exactly why it needs saying somewhere an administrator will
 * see it.
 */
export const STORAGE_TARGET_STATUSES = ['healthy', 'warning', 'error'] as const

export type StorageTargetStatus = (typeof STORAGE_TARGET_STATUSES)[number]

export interface StorageTargetState {
  status: StorageTargetStatus
  /** What went wrong. Empty when healthy. */
  message: string
  /**
   * When this was last written, ISO-8601 to the millisecond, or null for a target that has not done
   * anything yet.
   */
  updatedAt: string | null
}

export interface StorageAction {
  /** Key of the handler on the module implementation, i.e. what gets called. */
  handler: string
  label: string
  hint: string
  /** Shown in red, and turned into a confirmation prompt by the admin area. */
  warn?: string
  icon: string
}

/** A storage module, as declared by its `definition.yml`. */
export interface StorageDefinition {
  key: string
  title: string
  description: string
  icon: string
  banner: string
  vendor: string
  website: string
  contentTypes: {
    defaultTypesEnabled: string[]
  }
  assetDelivery: {
    isStreamingSupported: boolean
    isDirectAccessSupported: boolean
    defaultStreamingEnabled: boolean
    defaultDirectAccessEnabled: boolean
  }
  props: Record<string, ModuleProp>
  actions: StorageAction[]
  /**
   * Whether a `storage.ts` sits next to the definition.
   *
   * Actions are gated on this, so that the admin area never offers to run something that has no
   * implementation behind it, and so is dispatching content: a target whose module is definition-only
   * cannot be asked to hold anything.
   */
  hasImplementation: boolean
}

/** A configured target: the module definition, plus how this site has it set up. */
export interface StorageTarget {
  id: string
  siteId: string
  module: string
  isEnabled: boolean
  title: string
  description: string
  icon: string
  banner: string
  vendor: string
  website: string
  contentTypes: {
    activeTypes: string[]
  }
  assetDelivery: {
    isStreamingSupported: boolean
    isDirectAccessSupported: boolean
    streaming: boolean
    directAccess: boolean
    /**
     * The content types this target is the site's delivery source for, i.e. the ones a reader's
     * request for a file is answered from here.
     *
     * A subset of `contentTypes.activeTypes` — a target cannot serve what it was never asked to
     * store — and, across a site, each type names at most one target. Nothing here is about pages:
     * a page is read from its own row and never from a target.
     */
    servedTypes: string[]
  }
  props: Record<string, ModuleProp>
  config: Record<string, any>
  actions: StorageAction[]
  /**
   * The outcome of the last thing this target was asked to do — see `recordState`, which is the only
   * thing that writes it. Not part of `StorageTargetInput`: it is observed, not configured.
   */
  state: StorageTargetState
}

/** The shape a target is written with. Every field is optional, i.e. it doubles as a patch. */
export interface StorageTargetInput {
  id: string
  isEnabled?: boolean
  contentTypes?: {
    activeTypes?: string[]
  }
  assetDelivery?: {
    streaming?: boolean
    directAccess?: boolean
    servedTypes?: string[]
  }
  config?: Record<string, any>
}

/**
 * Where an asset sits, which is all a target needs in order to find its copy of one.
 *
 * Deliberately not a record of where the bytes went: an asset is written to *every* target
 * configured to hold its kind, so there is no single place to record, and each target derives its
 * own from this the same way it derives a page's. What a read then does is pick which of those
 * targets to ask — see `deliveryTargetFor`.
 */
export interface StorageAssetRef {
  id: string
  siteId: string
  locale: string
  /** Slash-separated, without the file name. Empty at the site root. */
  folderPath: string
  fileName: string
  kind: AssetKind
  fileSize: number
}

/** Where an asset used to sit, for a target following a rename. */
export interface StorageAssetLocation {
  locale: string
  folderPath: string
  fileName: string
}

/** Where a page sits, which is all a target needs in order to find its copy of one. */
export interface StoragePageRef {
  id: string
  siteId: string
  locale: string
  /** Slash-separated, with no leading slash and no file extension. */
  path: string
  /**
   * What its editor produces, which is what decides the extension it is filed under.
   *
   * Carried on the reference rather than on the content because a delete and a move need it too, and
   * a target that guessed would be reaching for names belonging to other content — in a folder where
   * pages and assets sit together, `readme.html` may well be somebody's attachment.
   */
  contentType: string
}

/** A page as it is handed to a target: enough to write a file that stands on its own. */
export interface StoragePageContent {
  title: string
  description: string
  /** Which editor authored it, and so what the body is written in. */
  editor: string
  tags: string[]
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  /** The source, as the author wrote it. Never the render. */
  content: string
}

/**
 * What a storage module implementation exports.
 *
 * Assets and pages are stored the same way — written to every target configured to hold them, and
 * addressed by where they sit rather than by a record of where they went. What differs is how a
 * failure is treated. A **page** is always in the database, so a target that could not keep up costs
 * the wiki a stale copy and the write is allowed to fail. An **asset** may have no copy in the
 * database at all, so every target claiming it has to accept the write or the upload fails.
 */
export interface StorageModule {
  /** Store this target's copy of an asset's bytes, replacing any copy it already had. */
  putAsset: (target: StorageTarget, ref: StorageAssetRef, data: Buffer) => Promise<void>
  /** Read its copy back. Null when this target does not have one. */
  getAsset: (target: StorageTarget, ref: StorageAssetRef) => Promise<Buffer | null>
  /** Drop its copy. Must not fail over bytes that are already gone. */
  deleteAsset: (target: StorageTarget, ref: StorageAssetRef) => Promise<void>
  /** Follow a rename, `ref` being where the asset now sits. */
  moveAsset: (
    target: StorageTarget,
    ref: StorageAssetRef,
    previous: StorageAssetLocation
  ) => Promise<void>
  /** Write this target's copy of a page, replacing whatever copy it already had. */
  putPage: (target: StorageTarget, ref: StoragePageRef, page: StoragePageContent) => Promise<void>
  /** Drop its copy. Must not fail over a copy that is not there. */
  deletePage: (target: StorageTarget, ref: StoragePageRef) => Promise<void>
  /** Follow a move, `ref` being where the page now is. */
  movePage: (target: StorageTarget, ref: StoragePageRef, previousPath: string) => Promise<void>
  /** Handlers named by the definition's actions. */
  [handler: string]: any
}

/**
 * A size threshold as bytes.
 *
 * @returns Infinity for anything unparseable, so that a threshold nobody can read diverts no files
 *   rather than diverting all of them
 */
export function parseSize(value: string): number {
  const match = /^(\d+(?:\.\d+)?)\s?(b|kb|mb|gb|tb)$/i.exec(String(value ?? '').trim())
  if (!match) {
    return Number.POSITIVE_INFINITY
  }
  return Number(match[1]) * SIZE_UNIT_BYTES[match[2].toLowerCase()]
}

/**
 * Storage model
 *
 * A storage target is one module configured for one site — the local disk for images, the database
 * for everything else, and so on. Each module lives in `modules/storage/<key>/definition.yml`, which
 * declares what it supports and what it needs configured, next to a `storage.ts` holding the code
 * that actually moves bytes. Every site gets a row per module (see `syncSite`), so a target always
 * has a stable ID whether or not it has ever been enabled.
 *
 * An asset's metadata — its name, its place in the tree, its size and type — stays in the database
 * whatever holds the file. What a non-database target takes off the database's hands is the one
 * column that grows without bound.
 *
 * Nothing records where a given file went, because there is no single answer: a write goes to every
 * target claiming the content (`writeTargetsFor`) and a read picks one of them (`deliveryTargetsFor`),
 * both derived from the configuration as it stands rather than from anything stored per file.
 */
class Storage {
  /** Definitions read from disk, refreshed by `refreshFromDisk()`. */
  definitions: StorageDefinition[] = []

  /** Implementations loaded by `ensureModule()`, keyed by module. */
  modules: Record<string, StorageModule> = {}

  /** Configured targets, keyed by site. See `TARGET_CACHE_TTL_MS` for what keeps this honest. */
  targetCache = new Map<string, { targets: StorageTarget[]; cachedAt: number }>()

  /**
   * Load the storage module definitions from disk.
   */
  async refreshFromDisk(): Promise<void> {
    const storagePath = path.join(WIKI.SERVERPATH, 'modules/storage')
    const definitions: StorageDefinition[] = []
    try {
      for (const dir of await fs.readdir(storagePath)) {
        const raw = await fs.readFile(path.join(storagePath, dir, 'definition.yml'), 'utf8')
        const parsed = load(raw) as Record<string, any>
        // -> The directory name is the key, as it is for every other module type
        parsed.key = dir
        // -> Props carry a display `order`, applied once here so that every consumer — the admin
        //    area included — reads them in the order the module meant them to be shown in
        parsed.props = Object.fromEntries(
          Object.entries(parseModuleProps(parsed.props ?? {})).sort(
            ([, a], [, b]) => a.order - b.order
          )
        )
        // -> Declared as a map keyed by handler, which is far more readable in YAML than a list of
        //    objects, but the handler has to travel with the action for it to be callable
        parsed.actions = Object.entries(parsed.actions ?? {}).map(([handler, action]) => ({
          handler,
          ...(action as Omit<StorageAction, 'handler'>)
        }))
        parsed.hasImplementation = await this.hasImplementation(dir)
        definitions.push(parsed as StorageDefinition)
      }
      // -> The database target first, then alphabetically: it is the one every site starts with
      this.definitions = definitions.sort((a, b) =>
        a.key === DB_MODULE ? -1 : b.key === DB_MODULE ? 1 : a.title.localeCompare(b.title)
      )
      WIKI.logger.info(`Found ${this.definitions.length} storage modules [ OK ]`)
    } catch (err: any) {
      this.definitions = []
      WIKI.logger.error(
        `Could not read the storage module definitions at ${storagePath} [ FAILED ]`
      )
      WIKI.logger.error(err.message)
    }
  }

  /**
   * Whether the module has any code to run, as opposed to only a definition
   */
  async hasImplementation(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(WIKI.SERVERPATH, 'modules/storage', key, 'storage.ts'))
      return true
    } catch {
      return false
    }
  }

  /**
   * A single definition, or null when nothing on disk declares that key
   */
  getDefinition(key: string): StorageDefinition | null {
    return this.definitions.find((d) => d.key === key) ?? null
  }

  /**
   * Give a site a row per installed module, and drop rows for modules no longer on disk.
   *
   * Existing rows are left alone: their settings belong to the site, whereas everything the
   * definition declares is read from disk on every request rather than copied into the row.
   */
  async syncSite(siteId: string): Promise<void> {
    const existing = await WIKI.db
      .select({ module: storageTable.module })
      .from(storageTable)
      .where(eq(storageTable.siteId, siteId))
    const existingKeys = existing.map((t) => t.module)
    const definedKeys = this.definitions.map((d) => d.key)

    for (const definition of this.definitions) {
      if (existingKeys.includes(definition.key)) {
        continue
      }
      await WIKI.db.insert(storageTable).values({
        siteId,
        module: definition.key,
        // -> Content has to land somewhere from the moment a site exists
        isEnabled: definition.key === DB_MODULE,
        contentTypes: {
          activeTypes: definition.contentTypes?.defaultTypesEnabled ?? []
        },
        assetDelivery: {
          streaming: definition.assetDelivery?.defaultStreamingEnabled ?? false,
          directAccess: definition.assetDelivery?.defaultDirectAccessEnabled ?? false,
          // -> A new target serves nothing until a site says so: content already uploaded is not on
          //    it, so nominating it as a source on its own would answer 404 for every existing file
          servedTypes: definition.key === DB_MODULE ? [...CONTENT_TYPES] : []
        },
        // -> Nothing has gone wrong with a target that has not been asked for anything yet
        state: { status: 'healthy', message: '', updatedAt: null } satisfies StorageTargetState,
        config: this.buildConfig(definition.key)
      })
    }

    // -> A module removed from disk should not linger in the admin list
    const orphaned = existingKeys.filter((key) => !definedKeys.includes(key))
    if (orphaned.length > 0) {
      await WIKI.db
        .delete(storageTable)
        .where(and(eq(storageTable.siteId, siteId), inArray(storageTable.module, orphaned)))
    }
    this.targetCache.delete(siteId)
  }

  /**
   * Register the installed storage modules for every site. Called at boot, after the sites cache.
   */
  async syncAllSites(): Promise<void> {
    WIKI.logger.info('Registering storage targets for all sites...')
    const sites = await WIKI.db.select({ id: sitesTable.id }).from(sitesTable)
    for (const site of sites) {
      await WIKI.models.storage.syncSite(site.id)
    }
    WIKI.logger.info(`Registered storage targets for ${sites.length} sites [ OK ]`)
  }

  /**
   * The stored target rows, without anything merged in from disk
   */
  async getTargets({
    siteId,
    enabledOnly = false
  }: { siteId?: string; enabledOnly?: boolean } = {}) {
    const conditions = [
      siteId ? eq(storageTable.siteId, siteId) : undefined,
      enabledOnly ? eq(storageTable.isEnabled, true) : undefined
    ].filter(Boolean)
    return WIKI.db
      .select()
      .from(storageTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
  }

  /**
   * Every target of a site, in the order the admin area lists them.
   *
   * Config values are completed from the module's declared defaults, so a prop added to a module
   * after a target was configured is returned with its default rather than as a missing key.
   */
  async getSiteTargets(siteId: string): Promise<StorageTarget[]> {
    const rows = await this.getTargets({ siteId })
    const targets: StorageTarget[] = []
    // -> Driven by the definitions rather than by the rows, so that the list is ordered the same way
    //    and a module dropped on disk without a restart is simply absent instead of half-present
    for (const definition of this.definitions) {
      const row = rows.find((t) => t.module === definition.key)
      if (!row) {
        continue
      }
      const contentTypes = (row.contentTypes ?? {}) as Record<string, any>
      const assetDelivery = (row.assetDelivery ?? {}) as Record<string, any>
      const state = (row.state ?? {}) as Record<string, any>
      targets.push({
        id: row.id,
        siteId,
        module: definition.key,
        isEnabled: row.isEnabled,
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        banner: definition.banner,
        vendor: definition.vendor,
        website: definition.website,
        contentTypes: {
          activeTypes: contentTypes.activeTypes ?? []
        },
        assetDelivery: {
          isStreamingSupported: definition.assetDelivery?.isStreamingSupported ?? false,
          isDirectAccessSupported: definition.assetDelivery?.isDirectAccessSupported ?? false,
          streaming: assetDelivery.streaming ?? false,
          directAccess: assetDelivery.directAccess ?? false,
          servedTypes: assetDelivery.servedTypes ?? []
        },
        props: definition.props,
        config: this.buildConfig(definition.key, {}, row.config as Record<string, any>),
        // -> An action with nothing behind it cannot be run
        actions: definition.hasImplementation ? definition.actions : [],
        state: {
          status: (STORAGE_TARGET_STATUSES as readonly string[]).includes(state.status)
            ? (state.status as StorageTargetStatus)
            : 'healthy',
          message: typeof state.message === 'string' ? state.message : '',
          updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null
        }
      })
    }
    return targets
  }

  /**
   * The same list, answered from memory where it can be.
   *
   * What every upload and every cache-missing read resolves through, hence the cache: those are hot
   * paths, and the answer changes only when an administrator saves the storage form.
   */
  async getCachedSiteTargets(siteId: string): Promise<StorageTarget[]> {
    const cached = this.targetCache.get(siteId)
    if (cached && Date.now() - cached.cachedAt < TARGET_CACHE_TTL_MS) {
      return cached.targets
    }
    const targets = await this.getSiteTargets(siteId)
    this.targetCache.set(siteId, { targets, cachedAt: Date.now() })
    return targets
  }

  /**
   * A single target of a site, or null if there is no such target
   */
  async getSiteTargetById(siteId: string, id: string): Promise<StorageTarget | null> {
    return (await this.getSiteTargets(siteId)).find((t) => t.id === id) ?? null
  }

  /**
   * Merge incoming config values onto the ones already stored, keeping only what the module declares.
   *
   * Read-only props are never taken from the client: they are declarations of something the server
   * does not support changing, so the stored value (or the module default) always wins.
   */
  buildConfig(
    moduleKey: string,
    incoming: Record<string, any> = {},
    existing: Record<string, any> = {}
  ): Record<string, any> {
    const props = this.getDefinition(moduleKey)?.props ?? {}
    const config: Record<string, any> = {}
    for (const [key, prop] of Object.entries(props)) {
      const current = existing[key] !== undefined ? existing[key] : prop.default
      config[key] = prop.readOnly || incoming[key] === undefined ? current : incoming[key]
    }
    return config
  }

  /**
   * Check incoming config values against what the module declares.
   *
   * The props are a runtime declaration read from a YAML file, so no JSON Schema can cover them —
   * without this, a boolean prop would happily store the string `"maybe"`.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validateConfig(moduleKey: string, incoming: Record<string, any> = {}): string | null {
    const props = this.getDefinition(moduleKey)?.props ?? {}
    for (const [key, value] of Object.entries(incoming)) {
      const prop = props[key]
      // -> Unknown keys are dropped by buildConfig rather than refused: a module losing a prop must
      //    not make the admin area unable to save
      if (!prop || prop.readOnly || value === undefined) {
        continue
      }
      if (prop.enum) {
        // -> Enum entries are declared as `value` or `value|label`
        const allowed = prop.enum.map((entry) => entry.split('|')[0])
        if (!allowed.includes(`${value}`)) {
          return `"${value}" is not a valid value for ${prop.title}.`
        }
        continue
      }
      switch (prop.type) {
        case 'boolean':
          if (typeof value !== 'boolean') {
            return `${prop.title} must be true or false.`
          }
          break
        case 'number':
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return `${prop.title} must be a number.`
          }
          break
        default:
          if (typeof value !== 'string') {
            return `${prop.title} must be a string.`
          }
      }
    }
    return null
  }

  /**
   * Check a target patch against what its module supports.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validateTarget(target: StorageTarget, patch: StorageTargetInput): string | null {
    const definition = this.getDefinition(target.module)!
    if (patch.isEnabled === false && target.module === DB_MODULE) {
      return 'The database storage target cannot be disabled, as content would have nowhere to live.'
    }
    if (patch.isEnabled === true && !definition.hasImplementation) {
      return `${definition.title} cannot be enabled: this module has no implementation installed.`
    }
    const activeTypes = patch.contentTypes?.activeTypes
    if (activeTypes) {
      const unknown = activeTypes.find(
        (type) => !(CONTENT_TYPES as readonly string[]).includes(type)
      )
      if (unknown) {
        return `"${unknown}" is not a valid content type.`
      }
      if (target.module === DB_MODULE && !activeTypes.includes('pages')) {
        return 'The database storage target must keep holding pages.'
      }
    }
    const servedTypes = patch.assetDelivery?.servedTypes
    if (servedTypes) {
      const stored = activeTypes ?? target.contentTypes.activeTypes
      const unknown = servedTypes.find(
        (type) => !(CONTENT_TYPES as readonly string[]).includes(type)
      )
      if (unknown) {
        return `"${unknown}" is not a valid content type.`
      }
      // -> Serving is reading back what was written here, so a target can only be nominated for what
      //    it is also configured to store. The admin area only offers the types that qualify.
      const unstored = servedTypes.find((type) => !stored.includes(type))
      if (unstored) {
        return `${definition.title} cannot serve ${unstored}, as it is not configured to store them.`
      }
    }
    return this.validateConfig(target.module, patch.config)
  }

  /**
   * Apply a patch to a target.
   *
   * Capabilities the module does not have are stored as off whatever was asked for — the admin area
   * disables those controls, but the values are the module's to decide, not the client's.
   *
   * @param target The target as it currently stands, which the caller already has from validating
   * @returns Whether the target was written
   */
  async updateTarget(
    siteId: string,
    target: StorageTarget,
    patch: StorageTargetInput
  ): Promise<boolean> {
    const definition = this.getDefinition(target.module)!

    const values: Partial<typeof storageTable.$inferInsert> = {}
    if (patch.isEnabled !== undefined) {
      values.isEnabled = patch.isEnabled
    }
    if (patch.contentTypes) {
      values.contentTypes = {
        activeTypes: patch.contentTypes.activeTypes ?? target.contentTypes.activeTypes
      }
    }
    /*
      A target that is off is nominated for nothing.

      Serving already falls back to the database while a target is off, so clearing this changes
      nothing today — what it prevents is later. A nomination left lying on a disabled target takes
      its content type back the moment somebody turns the target on again, and that is the one thing
      neither this method nor the admin area may do on its own: enabling a target is a statement about
      where content is *written*, and where it is *served from* is a separate answer the administrator
      gives separately.

      Worked out before the write rather than inside the branch below, because `isEnabled` and
      `assetDelivery` arrive independently — a patch that only turns the target off has to clear the
      nomination too, and a patch that nominates types while turning it off must not win.
    */
    const willBeEnabled = patch.isEnabled ?? target.isEnabled
    const servedTypes = willBeEnabled
      ? (patch.assetDelivery?.servedTypes ?? target.assetDelivery.servedTypes)
      : []
    if (patch.assetDelivery || (!willBeEnabled && target.assetDelivery.servedTypes.length > 0)) {
      values.assetDelivery = {
        streaming:
          definition.assetDelivery.isStreamingSupported &&
          (patch.assetDelivery?.streaming ?? target.assetDelivery.streaming),
        directAccess:
          definition.assetDelivery.isDirectAccessSupported &&
          (patch.assetDelivery?.directAccess ?? target.assetDelivery.directAccess),
        servedTypes
      }
    }
    if (patch.config !== undefined) {
      values.config = this.buildConfig(target.module, patch.config, target.config)
    }
    if (Object.keys(values).length < 1) {
      return false
    }

    const result = await WIKI.db
      .update(storageTable)
      .set(values)
      .where(and(eq(storageTable.siteId, siteId), eq(storageTable.id, target.id)))
    this.targetCache.delete(siteId)
    return (result.rowCount ?? 0) > 0
  }

  // == SITE CONFIGURATION =============

  /**
   * The size at which this site starts calling a file large.
   *
   * Stored with the rest of the site's configuration, since it decides what every target is offered
   * rather than what any one of them accepts. See `DEFAULT_LARGE_THRESHOLD`.
   */
  largeThresholdFor(siteId: string): string {
    return WIKI.sites[siteId]?.config?.storage?.largeThreshold ?? DEFAULT_LARGE_THRESHOLD
  }

  /**
   * Check a site-wide storage setting.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validateSiteConfig(patch: { largeThreshold?: string }): string | null {
    if (
      patch.largeThreshold !== undefined &&
      !/^\d+(\.\d+)?\s?(B|KB|MB|GB|TB)$/i.test(patch.largeThreshold)
    ) {
      return `"${patch.largeThreshold}" is not a valid size threshold. Use a size such as "5MB".`
    }
    return null
  }

  /**
   * Write a site-wide storage setting.
   *
   * Goes through the sites model rather than the table, so that the sites cache — which is where
   * `largeThresholdFor` reads it back from — is reloaded with it.
   *
   * @returns Whether anything was written
   */
  async updateSiteConfig(siteId: string, patch: { largeThreshold?: string }): Promise<boolean> {
    if (patch.largeThreshold === undefined) {
      return false
    }
    const updated = await WIKI.models.sites.updateSite(siteId, {
      config: { storage: { largeThreshold: patch.largeThreshold } }
    })
    // -> A target's content type depends on the threshold, so the resolved list is now stale
    this.targetCache.delete(siteId)
    return updated
  }

  // == ASSETS =========================

  /**
   * Which content type an asset falls into on this site.
   *
   * Large is a category of its own rather than a modifier on the others, which is what makes a
   * target able to take the 40 MB video without also taking every thumbnail. It is one answer for
   * the whole site: a file has to be the same kind of thing to every target, or one of them would
   * store the video as an image while another declined it as a large file.
   */
  contentTypeFor(siteId: string, kind: AssetKind, fileSize: number): ContentType {
    return fileSize >= parseSize(this.largeThresholdFor(siteId))
      ? 'large'
      : CONTENT_TYPE_BY_KIND[kind]
  }

  /**
   * Every target an asset of this kind and size is written to.
   *
   * **Not a choice between them.** A target's content types say what is stored there, and a site may
   * have the same kind stored in several places at once — the database and the local disk both
   * holding images is an ordinary configuration, not a mistake. Which of them a *read* goes to is a
   * separate question with a separate answer; see `deliveryTargetFor`.
   *
   * Ordered with the database last, so that the slowest and least interesting copy is written after
   * the others and read from only as a last resort.
   */
  async writeTargetsFor(
    siteId: string,
    kind: AssetKind,
    fileSize: number
  ): Promise<StorageTarget[]> {
    const targets = await this.getCachedSiteTargets(siteId)
    const contentType = this.contentTypeFor(siteId, kind, fileSize)
    return targets
      .filter(
        (t) =>
          t.isEnabled &&
          this.getDefinition(t.module)?.hasImplementation &&
          t.contentTypes.activeTypes.includes(contentType)
      )
      .sort((a, b) => (a.module === DB_MODULE ? 1 : b.module === DB_MODULE ? -1 : 0))
  }

  /**
   * The target an asset of this kind and size is served from, and the ones to fall back on.
   *
   * The first is whichever target the site nominated as the delivery source for that content type —
   * what `assetDelivery.servedTypes` records, and what the admin area's Content Delivery form sets.
   * The rest are every other target holding the same content, database last.
   *
   * **A type nobody has been nominated for is served from the database**, not from whichever other
   * target happens to be enabled. Enabling a target says where content is *written*; letting it
   * become the delivery source by the same act would move every reader's request onto a target that
   * was never chosen for it, and onto one that holds none of the files uploaded before it was turned
   * on. It is also what makes disabling a target put delivery back: the nomination stops applying,
   * and this is what it falls back to.
   *
   * The database gives that role up only by not holding the type at all — an administrator who
   * unticked large files there — in which case the first target that does hold them answers.
   *
   * There is a fallback list at all because a nominated source is not a promise that the file is
   * there: a target enabled after an upload never received it, and only the target's own export
   * action puts that right. Serving the file from somewhere slower beats answering that it is gone.
   */
  async deliveryTargetsFor(
    siteId: string,
    kind: AssetKind,
    fileSize: number
  ): Promise<StorageTarget[]> {
    const targets = await this.writeTargetsFor(siteId, kind, fileSize)
    const contentType = this.contentTypeFor(siteId, kind, fileSize)
    const source =
      targets.find((t) => (t.assetDelivery.servedTypes ?? []).includes(contentType)) ??
      targets.find((t) => t.module === DB_MODULE)
    return source ? [source, ...targets.filter((t) => t.id !== source.id)] : targets
  }

  /**
   * Write an asset's bytes to every target that holds its kind.
   *
   * @throws When any of them refuses, which fails the upload. Unlike a page, an asset may have no
   *   copy in the database to fall back on, so a half-stored asset is not something to report as
   *   success — the caller undoes the rest of the upload.
   */
  async putAsset(ref: StorageAssetRef, data: Buffer): Promise<void> {
    const targets = await this.writeTargetsFor(ref.siteId, ref.kind, ref.fileSize)
    if (targets.length < 1) {
      throw new Error(
        `This site has no storage target configured to hold ${this.contentTypeFor(ref.siteId, ref.kind, ref.fileSize)}.`
      )
    }
    for (const target of targets) {
      const mod = await this.ensureModule(target.module)
      if (!mod) {
        throw new Error(`The ${target.title} storage module has no implementation installed.`)
      }
      try {
        await mod.putAsset(target, ref, data)
      } catch (err: any) {
        // -> `error` rather than `warning`: this rethrows, so the upload itself failed
        await this.recordState(target, 'error', `Could not store ${ref.fileName}: ${err.message}`)
        throw err
      }
      await this.recordState(target, 'healthy')
    }
  }

  /**
   * Read an asset's bytes, from the target the site serves that content type from.
   *
   * @returns Null when no target holding it still has it, which a caller should treat as a missing
   *   file rather than as a failure
   */
  async getAsset(ref: StorageAssetRef): Promise<Buffer | null> {
    const targets = await this.deliveryTargetsFor(ref.siteId, ref.kind, ref.fileSize)
    for (const [index, target] of targets.entries()) {
      const mod = await this.ensureModule(target.module)
      if (!mod) {
        continue
      }
      try {
        const data = await mod.getAsset(target, ref)
        if (data) {
          if (index > 0) {
            WIKI.logger.debug(
              `Asset ${ref.id} was not on the delivery source and was read from ${target.title}.`
            )
          }
          return data
        }
      } catch (err: any) {
        // -> A target that is down is a reason to try the next one, not to answer that the file is
        //    gone. Only once every one of them has been asked is it actually missing.
        WIKI.logger.warn(`${target.title} could not serve asset ${ref.id} [ SKIPPED ]`)
        WIKI.logger.warn(err.message)
        await this.recordState(target, 'warning', `Could not read ${ref.fileName}: ${err.message}`)
      }
    }
    return null
  }

  /**
   * Drop every target's copy of an asset. Never throws over bytes that are already gone.
   */
  async removeAsset(ref: StorageAssetRef): Promise<void> {
    await this.eachAssetTarget(ref, `delete the asset ${ref.fileName}`, (mod, target) =>
      mod.deleteAsset(target, ref)
    )
  }

  /**
   * Move every target's copy of an asset, `ref` being where it now sits.
   */
  async relocateAsset(ref: StorageAssetRef, previous: StorageAssetLocation): Promise<void> {
    if (
      previous.locale === ref.locale &&
      previous.folderPath === ref.folderPath &&
      previous.fileName === ref.fileName
    ) {
      return
    }
    await this.eachAssetTarget(ref, `move the asset ${previous.fileName}`, (mod, target) =>
      mod.moveAsset(target, ref, previous)
    )
  }

  /**
   * Run something against every target holding an asset, surviving any of them failing.
   *
   * For the operations where failing is not worth refusing the request over: the metadata is going
   * either way, and a copy left behind on one target is untidy rather than wrong. A *write* is not
   * one of these — see `putAsset`.
   *
   * @param operationDescription What is being attempted, as an infinitive phrase that completes
   *   "could not …" — `delete the asset logo.png`. It reaches an administrator as well as the log,
   *   in the target's recorded state, so it names the thing rather than the method.
   */
  private async eachAssetTarget(
    ref: StorageAssetRef,
    operationDescription: string,
    run: (mod: StorageModule, target: StorageTarget) => Promise<void>
  ): Promise<void> {
    for (const target of await this.writeTargetsFor(ref.siteId, ref.kind, ref.fileSize)) {
      const mod = await this.ensureModule(target.module)
      if (!mod) {
        continue
      }
      try {
        await run(mod, target)
        await this.recordState(target, 'healthy')
      } catch (err: any) {
        WIKI.logger.warn(`${target.title} could not ${operationDescription} [ SKIPPED ]`)
        WIKI.logger.warn(err.message)
        // -> `warning`, not `error`: nothing was refused over this. The metadata went either way and
        //    the request the administrator or author made succeeded — what is wrong is that this
        //    target's copy is now out of step, which nothing else would ever tell them.
        await this.recordState(
          target,
          'warning',
          `Could not ${operationDescription}: ${err.message}`
        )
      }
    }
  }

  // == PAGES ==========================

  /**
   * The targets currently keeping a copy of every page.
   *
   * The database is among them and is not a backup: it is where a page *is*, written by the pages
   * model as a column, which is why its module implements the page handlers as no-ops. Every other
   * target in this list is a copy — an administrator ticking `pages` on the local disk is asking for
   * the wiki's pages to exist as files as well, not instead.
   */
  async pageTargets(siteId: string): Promise<StorageTarget[]> {
    const targets = await this.getCachedSiteTargets(siteId)
    return targets.filter(
      (t) =>
        t.isEnabled &&
        t.contentTypes.activeTypes.includes('pages') &&
        this.getDefinition(t.module)?.hasImplementation
    )
  }

  /**
   * Run something against every target keeping pages, surviving any of them failing.
   *
   * The reason page dispatch has no equivalent of the asset path's error handling: a page is already
   * saved in the database by the time any of this runs, so a full disk or a revoked credential costs
   * the wiki a backup, not an edit. Each failure is logged and the next target still gets its copy.
   *
   * @param operationDescription As in `eachAssetTarget` — an infinitive phrase completing
   *   "could not …", e.g. `store the page at guides/setup`.
   */
  private async eachPageTarget(
    siteId: string,
    operationDescription: string,
    run: (mod: StorageModule, target: StorageTarget) => Promise<void>
  ): Promise<void> {
    for (const target of await this.pageTargets(siteId)) {
      const mod = await this.ensureModule(target.module)
      if (!mod) {
        continue
      }
      try {
        await run(mod, target)
        await this.recordState(target, 'healthy')
      } catch (err: any) {
        WIKI.logger.warn(`${target.title} could not ${operationDescription} [ SKIPPED ]`)
        WIKI.logger.warn(err.message)
        // -> See `eachAssetTarget`: the page is saved in the database whatever happened here, so this
        //    is a copy that has fallen behind rather than an edit that was lost
        await this.recordState(
          target,
          'warning',
          `Could not ${operationDescription}: ${err.message}`
        )
      }
    }
  }

  /**
   * Write every page-keeping target's copy of a page.
   */
  async mirrorPage(ref: StoragePageRef, page: StoragePageContent): Promise<void> {
    await this.eachPageTarget(ref.siteId, `store the page at ${ref.path}`, (mod, target) =>
      mod.putPage(target, ref, page)
    )
  }

  /**
   * Drop every page-keeping target's copy of a page.
   */
  async removePage(ref: StoragePageRef): Promise<void> {
    await this.eachPageTarget(ref.siteId, `delete the page at ${ref.path}`, (mod, target) =>
      mod.deletePage(target, ref)
    )
  }

  /**
   * Move every page-keeping target's copy of a page, `ref` being where it now is.
   */
  async relocatePage(ref: StoragePageRef, previousPath: string): Promise<void> {
    if (previousPath === ref.path) {
      return
    }
    await this.eachPageTarget(
      ref.siteId,
      `move the page from ${previousPath} to ${ref.path}`,
      (mod, target) => mod.movePage(target, ref, previousPath)
    )
  }

  /**
   * Ensure a module's implementation is loaded
   *
   * @returns The implementation, or null when the module has none or it failed to load
   */
  async ensureModule(key: string): Promise<StorageModule | null> {
    if (this.modules[key]) {
      return this.modules[key]
    }
    if (!this.getDefinition(key)?.hasImplementation) {
      return null
    }
    try {
      // -> Extension-sensitive dynamic import, invisible to the type checker
      this.modules[key] = (await import(`../modules/storage/${key}/storage.ts`)).default
      WIKI.logger.debug(`Activated storage module ${key} [ OK ]`)
      return this.modules[key]
    } catch (err: any) {
      WIKI.logger.warn(`Failed to load storage module ${key} [ FAILED ]`)
      WIKI.logger.warn(err)
      return null
    }
  }

  /**
   * Record how a target is behaving, having just asked it to do something.
   *
   * The counterpart to everything else on this model: the rest of it writes what an administrator
   * configured, and this writes what happened when the wiki tried to use it. A target that cannot be
   * written to is otherwise invisible — the upload that failed says so to whoever was uploading, and
   * a page copy that could not be written says so only to the server log, which nobody is watching.
   *
   * **The last operation wins.** This is not an incident log: the target reports its most recent
   * outcome, and a successful write clears an earlier failure. That is what makes it self-correcting —
   * a full disk that gets emptied stops being reported without anybody dismissing anything — and it
   * is why the timestamp travels with it, so that "healthy" can be read as of when.
   *
   * Written only when it says something new, because the success path runs on every upload and every
   * page save. The cached target is patched in step, so the check keeps holding within the cache's
   * lifetime rather than costing a read.
   */
  async recordState(
    target: StorageTarget,
    status: StorageTargetStatus,
    message = ''
  ): Promise<void> {
    if (target.state.status === status && target.state.message === message) {
      return
    }
    const state: StorageTargetState = {
      status,
      message,
      updatedAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' })
    }
    // -> In place, so that every holder of this object — the cache above all — agrees with the row
    target.state = state
    await WIKI.db.update(storageTable).set({ state }).where(eq(storageTable.id, target.id))
  }

  /**
   * Run one of the actions a module declares.
   *
   * @param actorId Who asked for it, so that an action creating content can say who authored it
   * @returns What the module wants reported back, if anything
   * @throws When the module cannot be loaded or does not implement the handler
   */
  async executeAction(
    target: StorageTarget,
    handler: string,
    actorId: string
  ): Promise<string | undefined> {
    const mod = await this.ensureModule(target.module)
    if (!mod) {
      throw new Error(`The ${target.title} storage module has no implementation installed.`)
    }
    if (typeof mod[handler] !== 'function') {
      throw new Error(`The ${target.title} storage module does not implement "${handler}".`)
    }
    // -> An action is the heaviest thing a target is ever asked to do — an export writes every file
    //    the site has — so its outcome is the most informative one there is about the target's health
    try {
      const result = await mod[handler](target, actorId)
      await this.recordState(target, 'healthy')
      return result
    } catch (err: any) {
      await this.recordState(target, 'error', `${handler} failed: ${err.message}`)
      throw err
    }
  }
}

export const storage = new Storage()
