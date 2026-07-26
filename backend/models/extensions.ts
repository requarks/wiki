import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'

/** How an extension's presence on this system is detected. */
export interface ExtensionDetection {
  /** `command` looks for an executable on PATH, `module` for a resolvable npm package. */
  type: 'command' | 'module'
  value: string
}

/** An extension as declared by its `definition.yml`. */
export interface ExtensionDefinition {
  key: string
  title: string
  description: string
  website?: string
  detect: ExtensionDetection
  /** Architectures the extension can run on. Any architecture when absent. */
  architectures?: string[]
  /** Platforms the extension can run on. Any platform when absent. */
  platforms?: string[]
  /** Whether the admin area can install it, as opposed to it being installed by hand. */
  isInstallable: boolean
}

/** An extension plus its state on this system, as exposed by the API. */
export interface ExtensionState {
  key: string
  title: string
  description: string
  website: string
  isInstalled: boolean
  isInstallable: boolean
  isCompatible: boolean
}

/**
 * Whether an executable of this name exists on PATH.
 *
 * Walks PATH rather than shelling out to `which` / `where`, which is both faster and free of any
 * quoting concerns around the name being looked up.
 */
async function commandExists(command: string): Promise<boolean> {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  // -> On Windows the name on disk carries an extension, e.g. `git.exe`
  const suffixes =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : ['']

  for (const dir of dirs) {
    for (const suffix of suffixes) {
      try {
        await fs.access(path.join(dir, `${command}${suffix}`), fs.constants.X_OK)
        return true
      } catch {
        // -> Not in this directory, or not executable by us; keep looking
      }
    }
  }
  return false
}

/**
 * Whether an npm package is installed in the backend's `node_modules`.
 *
 * Not `import()`: optional dependencies like Sharp load native binaries, which is expensive and can
 * fail for reasons that have nothing to do with the package being there. Not `import.meta.resolve`
 * either — it caches package.json lookups, so a package removed after being resolved once keeps
 * reporting as present until the server restarts, which is the misleading direction here. Reading the
 * manifest is cheap and always current.
 */
async function moduleExists(specifier: string): Promise<boolean> {
  try {
    await fs.access(path.join(WIKI.SERVERPATH, 'node_modules', specifier, 'package.json'))
    return true
  } catch {
    return false
  }
}

/**
 * Extensions model
 *
 * Optional third-party tooling that unlocks extra functionality — a Git binary, Pandoc, Sharp,
 * Puppeteer. Each lives in `modules/extensions/<key>/definition.yml`, which declares how to detect
 * it and what it is compatible with. Nothing here installs anything: these are installed with the
 * system package manager or as optional dependencies, which is what the admin area links out to.
 */
class Extensions {
  /** Definitions read from disk, refreshed by `refreshFromDisk()`. */
  definitions: ExtensionDefinition[] = []

  /**
   * Load the extension definitions from disk.
   */
  async refreshFromDisk(): Promise<void> {
    const extensionsPath = path.join(WIKI.SERVERPATH, 'modules/extensions')
    const definitions: ExtensionDefinition[] = []
    try {
      for (const dir of await fs.readdir(extensionsPath)) {
        const raw = await fs.readFile(path.join(extensionsPath, dir, 'definition.yml'), 'utf8')
        const parsed = yaml.load(raw) as ExtensionDefinition
        // -> The directory name is the key, as it is for every other module type
        parsed.key = dir
        definitions.push(parsed)
      }
      this.definitions = definitions.sort((a, b) => a.title.localeCompare(b.title))
      WIKI.logger.info(`Found ${this.definitions.length} extensions [ OK ]`)
    } catch (err: any) {
      this.definitions = []
      WIKI.logger.warn(`Could not read the extension definitions at ${extensionsPath} [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
    }
  }

  /**
   * Whether this system can run the extension at all, regardless of whether it is installed
   */
  isCompatible(definition: ExtensionDefinition): boolean {
    if (definition.architectures && !definition.architectures.includes(os.arch())) {
      return false
    }
    if (definition.platforms && !definition.platforms.includes(process.platform)) {
      return false
    }
    return true
  }

  /**
   * Whether the extension is present on this system
   */
  async isInstalled(definition: ExtensionDefinition): Promise<boolean> {
    switch (definition.detect?.type) {
      case 'command':
        return commandExists(definition.detect.value)
      case 'module':
        return moduleExists(definition.detect.value)
      default:
        WIKI.logger.warn(`Extension ${definition.key} has no usable detection method.`)
        return false
    }
  }

  /**
   * Every extension with its current state.
   *
   * Detection runs on each call rather than being cached at boot, so that installing a tool and
   * hitting refresh in the admin area reflects reality without restarting the server.
   */
  async getExtensions(): Promise<ExtensionState[]> {
    const results: ExtensionState[] = []
    for (const definition of this.definitions) {
      const isCompatible = this.isCompatible(definition)
      results.push({
        key: definition.key,
        title: definition.title,
        description: definition.description,
        website: definition.website ?? '',
        // -> An incompatible extension cannot be present, and skipping the check keeps a pointless
        //    PATH walk out of the way
        isInstalled: isCompatible ? await this.isInstalled(definition) : false,
        isInstallable: definition.isInstallable === true,
        isCompatible
      })
    }
    return results
  }

  /**
   * A single definition, or null if there is no extension with this key
   */
  getDefinition(key: string): ExtensionDefinition | null {
    return this.definitions.find((d) => d.key === key) ?? null
  }

  /**
   * Log which extensions were found, the way the other module types report at boot
   */
  async logState(): Promise<void> {
    for (const extension of await this.getExtensions()) {
      if (!extension.isCompatible) {
        WIKI.logger.info(
          `Extension ${extension.key} is not compatible with this system. [ SKIPPED ]`
        )
      } else if (extension.isInstalled) {
        WIKI.logger.info(`Extension ${extension.key} is installed. [ OK ]`)
      } else {
        WIKI.logger.info(`Extension ${extension.key} was not found on this system. [ SKIPPED ]`)
      }
    }
  }
}

export const extensions = new Extensions()
