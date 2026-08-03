import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { asc, eq } from 'drizzle-orm'
import { parseModuleProps } from '../helpers/common.ts'
import { authentication as authenticationTable, groups as groupsTable } from '../db/schema.ts'
import type { ModuleProp } from '../helpers/common.ts'
import type { SystemIds } from './types.ts'

/** An authentication module, as declared by its `definition.yml`. */
export interface AuthModule {
  key: string
  title: string
  description: string
  logo?: string
  icon?: string
  color?: string
  vendor?: string
  website?: string
  isAvailable: boolean
  useForm: boolean
  usernameType: string
  props: Record<string, ModuleProp>
  refs?: Record<string, { title?: string; hint?: string; icon?: string; value: string }>
}

/**
 * What a redirect-based module is handed to build its authorization URL.
 *
 * The framework owns these values rather than each module inventing them: they are generated once per
 * login, kept on the session, and checked when the provider comes back — which is what makes the
 * answer belong to the browser that started the flow. A module that has no use for `nonce` or
 * `codeVerifier` (a plain OAuth2 provider) simply ignores them.
 */
export interface AuthFlow {
  /** Where the provider sends the browser back. Registered with the provider by the administrator. */
  redirectUri: string
  state: string
  nonce: string
  /** PKCE verifier, whose challenge goes on the authorization request. */
  codeVerifier: string
}

/** The same flow, once the provider has come back with an answer. */
export interface AuthFlowCallback extends AuthFlow {
  /** The callback URL as it arrived, query string included — what an OIDC library validates against. */
  currentUrl: string
  /** The authorization code, for a module that reads it directly rather than through a library. */
  code?: string
}

/**
 * Who signed in, as a module reports them.
 *
 * `id` is the provider's own identifier for the account and never changes; `email` is what the user is
 * matched or created by here. A module must not return an address it has not established belongs to
 * the person — an unverified one is how somebody signs in as somebody else.
 */
export interface ProviderProfile {
  id: string
  email: string
  name: string
}

/** A configured instance of an authentication module. */
export interface AuthStrategy {
  id: string
  module: string
  displayName: string
  isEnabled: boolean
  registration: boolean
  allowedEmailRegex: string
  autoEnrollGroups: string[]
  config: Record<string, any>
}

/** The module every wiki ships with. */
const LOCAL_MODULE = 'local'

/**
 * Whether this is the strategy the instance was seeded with.
 *
 * Not merely "a local strategy": every account's password is stored under this exact strategy ID
 * (see `models/users.ts`), so it is the one that cannot be disabled or deleted. A second instance of
 * the local module holds no credentials and is as disposable as any other strategy.
 */
function isBuiltInLocal(id: string): boolean {
  return id === WIKI.data.systemIds.localAuthId
}

/**
 * Authentication model
 */
class Authentication {
  async getStrategy(module: string) {
    return WIKI.db.select().from(authenticationTable).where(eq(authenticationTable.module, module))
  }

  async getStrategies({ enabledOnly = false }: { enabledOnly?: boolean } = {}) {
    return WIKI.db
      .select()
      .from(authenticationTable)
      .where(enabledOnly ? eq(authenticationTable.isEnabled, true) : undefined)
  }

  /**
   * The authentication modules found on disk, in the order the admin area lists them
   */
  getModules(): AuthModule[] {
    return [...((WIKI.data.authentication ?? []) as AuthModule[])].sort((a, b) =>
      a.key === LOCAL_MODULE ? -1 : b.key === LOCAL_MODULE ? 1 : a.title.localeCompare(b.title)
    )
  }

  /**
   * A single module definition, or null when nothing on disk declares that key
   */
  getModule(key: string): AuthModule | null {
    return this.getModules().find((m) => m.key === key) ?? null
  }

  /**
   * Every configured strategy, the built-in local one first, then alphabetically by display name.
   *
   * Config values are completed from the module's declared defaults, so a prop added to a module
   * after a strategy was configured is returned with its default rather than as a missing key.
   */
  async getActiveStrategies(): Promise<AuthStrategy[]> {
    const strategies = await WIKI.db
      .select()
      .from(authenticationTable)
      .orderBy(asc(authenticationTable.displayName))
    return strategies
      .map((stg) => ({
        ...stg,
        autoEnrollGroups: stg.autoEnrollGroups ?? [],
        config: this.buildConfig(stg.module, {}, stg.config as Record<string, any>)
      }))
      .sort((a, b) => (isBuiltInLocal(a.id) ? -1 : isBuiltInLocal(b.id) ? 1 : 0))
  }

  /**
   * A single configured strategy, or null if there is no such strategy
   */
  async getStrategyById(id: string): Promise<AuthStrategy | null> {
    return (await this.getActiveStrategies()).find((stg) => stg.id === id) ?? null
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
    const props = this.getModule(moduleKey)?.props ?? {}
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
    const props = this.getModule(moduleKey)?.props ?? {}
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
   * Check the fields shared by every strategy, whichever module it uses.
   *
   * @param strategy The values as they will end up stored, i.e. already merged with the current ones
   * @returns The reason it is invalid, or null when it is fine
   */
  async validateStrategy(strategy: {
    /** Omitted when the strategy does not exist yet, i.e. on create. */
    id?: string
    module: string
    displayName?: string
    isEnabled?: boolean
    allowedEmailRegex?: string
    autoEnrollGroups?: string[]
  }): Promise<string | null> {
    if (strategy.displayName !== undefined && strategy.displayName.trim().length < 1) {
      return 'The display name cannot be empty.'
    }
    if (strategy.id && isBuiltInLocal(strategy.id) && strategy.isEnabled === false) {
      return 'The built-in local strategy cannot be disabled, as it would leave no way to log in.'
    }
    if (strategy.allowedEmailRegex) {
      try {
        new RegExp(strategy.allowedEmailRegex)
      } catch (err: any) {
        return `The allowed email pattern is not a valid regular expression: ${err.message}`
      }
    }
    if (strategy.autoEnrollGroups && strategy.autoEnrollGroups.length > 0) {
      if (strategy.autoEnrollGroups.includes(WIKI.data.systemIds.guestsGroupId)) {
        return 'The guests group cannot be used for auto-enrollment.'
      }
      const existing = await WIKI.db.select({ id: groupsTable.id }).from(groupsTable)
      const existingIds = existing.map((g) => g.id)
      const unknown = strategy.autoEnrollGroups.find((id) => !existingIds.includes(id))
      if (unknown) {
        return `Group ${unknown} does not exist.`
      }
    }
    return null
  }

  /**
   * Configure a new instance of a module
   *
   * @returns The new strategy's ID
   */
  async createStrategy(values: {
    module: string
    displayName?: string
    isEnabled?: boolean
    registration?: boolean
    allowedEmailRegex?: string
    autoEnrollGroups?: string[]
    config?: Record<string, any>
  }): Promise<string> {
    const mod = this.getModule(values.module)!
    const result = await WIKI.db
      .insert(authenticationTable)
      .values({
        module: values.module,
        displayName: values.displayName?.trim() || mod.title,
        isEnabled: values.isEnabled ?? true,
        registration: values.registration ?? false,
        allowedEmailRegex: values.allowedEmailRegex ?? '',
        autoEnrollGroups: values.autoEnrollGroups ?? [],
        config: this.buildConfig(values.module, values.config)
      })
      .returning({ id: authenticationTable.id })

    await this.activateStrategies()
    return result[0].id
  }

  /**
   * Update a configured strategy.
   *
   * The strategies are reloaded afterwards, so a config change takes effect on the next login rather
   * than on the next restart.
   *
   * @returns Whether a strategy was updated
   */
  async updateStrategy(
    id: string,
    patch: {
      displayName?: string
      isEnabled?: boolean
      registration?: boolean
      allowedEmailRegex?: string
      autoEnrollGroups?: string[]
      config?: Record<string, any>
    }
  ): Promise<boolean> {
    const current = await this.getStrategyById(id)
    if (!current) {
      return false
    }

    const values: Partial<typeof authenticationTable.$inferInsert> = {}
    if (patch.displayName !== undefined) {
      values.displayName = patch.displayName.trim()
    }
    if (patch.isEnabled !== undefined) {
      values.isEnabled = patch.isEnabled
    }
    if (patch.registration !== undefined) {
      values.registration = patch.registration
    }
    if (patch.allowedEmailRegex !== undefined) {
      values.allowedEmailRegex = patch.allowedEmailRegex
    }
    if (patch.autoEnrollGroups !== undefined) {
      values.autoEnrollGroups = patch.autoEnrollGroups
    }
    if (patch.config !== undefined) {
      values.config = this.buildConfig(current.module, patch.config, current.config)
    }
    if (Object.keys(values).length < 1) {
      return false
    }

    const result = await WIKI.db
      .update(authenticationTable)
      .set(values)
      .where(eq(authenticationTable.id, id))
    if ((result.rowCount ?? 0) < 1) {
      return false
    }

    await this.activateStrategies()
    return true
  }

  /**
   * Delete a configured strategy, and stop every site from offering it.
   *
   * Users whose only credentials belong to this strategy lose their way in, which is why the built-in
   * local strategy — the one every account is seeded against — cannot be deleted.
   *
   * @returns Whether a strategy was deleted
   */
  async deleteStrategy(id: string): Promise<boolean> {
    const result = await WIKI.db.delete(authenticationTable).where(eq(authenticationTable.id, id))
    if ((result.rowCount ?? 0) < 1) {
      return false
    }

    // -> Sites keep their own ordered list of strategy IDs, which would otherwise keep a dangling one
    for (const site of await WIKI.models.sites.getAllSites()) {
      const configured = ((site.config as Record<string, any>)?.authStrategies ?? []) as Array<{
        id: string
      }>
      if (configured.some((s) => s.id === id)) {
        await WIKI.models.sites.updateSite(site.id, {
          config: { authStrategies: configured.filter((s) => s.id !== id) }
        })
      }
    }

    await this.activateStrategies()
    return true
  }

  async refreshStrategiesFromDisk(): Promise<void> {
    try {
      // -> Fetch definitions from disk
      const authenticationDirs = await fs.readdir(
        path.join(WIKI.SERVERPATH, 'modules/authentication')
      )
      WIKI.data.authentication = []
      for (const dir of authenticationDirs) {
        const def = await fs.readFile(
          path.join(WIKI.SERVERPATH, 'modules/authentication', dir, 'definition.yml'),
          'utf8'
        )
        const defParsed = yaml.load(def) as Record<string, any>
        if (!defParsed.isAvailable) {
          continue
        }
        defParsed.key = dir
        defParsed.props = parseModuleProps(defParsed.props)
        WIKI.data.authentication.push(defParsed)
        WIKI.logger.debug(`Loaded authentication module definition ${dir} [ OK ]`)
      }

      WIKI.logger.info(
        `Loaded ${WIKI.data.authentication.length} authentication module definitions [ OK ]`
      )
    } catch (err: any) {
      WIKI.logger.error('Failed to scan or load authentication module definitions [ FAILED ]')
      WIKI.logger.error(err)
    }
  }

  async activateStrategies(): Promise<void> {
    WIKI.logger.info('Activating authentication strategies...')

    // Unload any active strategies
    try {
      for (const strKey in WIKI.auth.strategies) {
        const strategy = WIKI.auth.strategies[strKey] as any
        if (typeof strategy.destroy === 'function') {
          await strategy.destroy()
        }
      }
    } catch (err: any) {
      WIKI.logger.warn(`Failed to unload active strategies [ FAILED ]`)
      WIKI.logger.warn(err)
    }
    WIKI.auth.strategies = {}

    // Load enabled strategies
    const enabledStrategies = await this.getStrategies({ enabledOnly: true })
    for (const stg of enabledStrategies) {
      try {
        const StrategyModule = (
          await import(`../modules/authentication/${stg.module}/authentication.ts`)
        ).default
        const strategy = new StrategyModule(stg.id, stg.config)
        WIKI.auth.strategies[stg.id] = strategy
        strategy.module = stg.module
        if (typeof strategy.init === 'function') {
          await strategy.init()
        }

        WIKI.logger.info(`Enabled authentication strategy ${stg.displayName} [ OK ]`)
      } catch (err: any) {
        WIKI.logger.error(
          `Failed to enable authentication strategy ${stg.displayName} (${stg.id}) [ FAILED ]`
        )
        WIKI.logger.error(err)
      }
    }
  }

  async init(ids: SystemIds): Promise<void> {
    await WIKI.db.insert(authenticationTable).values({
      id: ids.authModuleId,
      module: 'local',
      isEnabled: true,
      displayName: 'Local Authentication',
      config: {
        emailValidation: true,
        enforceTfa: false
      }
    })
  }
}

export const authentication = new Authentication()
