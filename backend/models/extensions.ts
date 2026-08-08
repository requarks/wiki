import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { load } from 'js-yaml'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * How long an install may run before it is given up on.
 *
 * Generous because of what the slowest one has to do: Puppeteer fetches a Chromium build of a few
 * hundred megabytes, which on a thin connection is minutes of transfer before npm has anything to
 * unpack. A ceiling rather than a wait — Sharp still finishes in seconds.
 */
const installTimeout = 20 * 60 * 1000

/** How much npm output is kept when reporting a failure, taken from the end where the error is. */
const installErrorLength = 800

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
  /**
   * The version `install()` asks npm for.
   *
   * For an extension that is not declared in `package.json` at all, which is the only place a version
   * would otherwise be written down — without it npm resolves whatever is newest today, and two
   * instances installed a month apart are running different software. An extension the manifest
   * already declares leaves this out, since a second pin here could only disagree with the first.
   */
  installVersion?: string
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
 * Puppeteer. Each lives in `modules/extensions/<key>/definition.yml`, which declares how to detect it,
 * what it is compatible with, and whether it can be installed from here.
 *
 * The `command` ones cannot be installed from here: a Git or Pandoc binary comes from the system
 * package manager, and the admin area links out to the instructions instead. An extension detected as
 * a `module` is an npm package, which `install()` can fetch — Sharp to replace a native binary that
 * is missing or does not match the platform, Puppeteer because it is deliberately not shipped and has
 * to come from somewhere.
 */
class Extensions {
  /** Definitions read from disk, refreshed by `refreshFromDisk()`. */
  definitions: ExtensionDefinition[] = []

  /**
   * npm specifiers this process tried to load and could not, reported by whoever attempted it.
   *
   * Node caches a failed module load for the lifetime of the process: an `import()` that threw keeps
   * throwing the same error afterwards, even once the files it was missing are back on disk. So a
   * repaired install does not take effect here until the server restarts, and the only way to know
   * that is to remember having failed.
   */
  loadFailures = new Set<string>()

  /**
   * Load the extension definitions from disk.
   */
  async refreshFromDisk(): Promise<void> {
    const extensionsPath = path.join(WIKI.SERVERPATH, 'modules/extensions')
    const definitions: ExtensionDefinition[] = []
    try {
      for (const dir of await fs.readdir(extensionsPath)) {
        const raw = await fs.readFile(path.join(extensionsPath, dir, 'definition.yml'), 'utf8')
        const parsed = load(raw) as ExtensionDefinition
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
   * Install, or reinstall, an extension with npm.
   *
   * Only a `module` extension can be installed from here — a `command` extension is an operating
   * system package, and no amount of npm will produce one. Callers are expected to have checked
   * `isInstallable` and `isCompatible` first; this repeats the detection check afterwards, since npm
   * exiting zero and the module actually being there are not the same claim.
   *
   * The two installable extensions ask for different things, and the flags below serve both.
   *
   * Sharp is a declared optional dependency, so an ordinary install already has it — reinstalling is
   * the point as much as installing is. What goes wrong is its *native* binary: an image built on one
   * platform and run on another, or an install that skipped optional dependencies, leaves the
   * JavaScript package in place and the binary for this OS and architecture missing.
   *
   * Puppeteer is not declared anywhere, so this is a genuine first install, and the bulk of it is the
   * browser. Nothing has to be arranged for that: Puppeteer's own postinstall fetches one into its
   * cache, which is the ordinary case and the one an install straight onto Linux takes. A server that
   * already has a browser opts out with `PUPPETEER_SKIP_DOWNLOAD` and points at it with
   * `PUPPETEER_EXECUTABLE_PATH` — what the Docker image does with the Chromium it takes from the
   * distro. Neither is required, and neither is set here: npm inherits this process's environment, so
   * an install from the admin area sees exactly what the operator set for the server and nothing else.
   *
   * Hence the flags:
   *
   * - `--no-save` because the manifest already declares the package, and an HTTP request has no
   *   business rewriting the manifests the release was built from.
   * - `--force` so npm refetches rather than deciding an already-present but unusable copy is fine.
   * - `--include=optional` because the per-platform binaries are themselves optional dependencies of
   *   the package, and omitting them is the usual cause of the failure being repaired here.
   * - `--no-ignore-scripts` because the browser IS Puppeteer's postinstall. An operator who has set
   *   `ignore-scripts` — a reasonable thing to harden an npm config with — would otherwise get the
   *   package with no browser under it, npm exiting zero, and this model reporting it as installed:
   *   the failure would surface much later, as a render that cannot start a browser. Which scripts
   *   are trusted is still decided by the `allowScripts` policy in `package.json`, and a package
   *   denied there is skipped whatever this flag says.
   *
   * @throws If the extension cannot be installed this way, if npm fails, or if the module is still
   *         missing afterwards
   */
  async install(definition: ExtensionDefinition): Promise<void> {
    if (definition.detect?.type !== 'module') {
      throw new Error(`${definition.title} is not an npm package, so it cannot be installed here.`)
    }
    const specifier = definition.detect.value
    // -> What npm is asked for, which carries the pin; what is checked for afterwards is the package
    //    name on its own, since that is what lands in `node_modules`
    const request = definition.installVersion
      ? `${specifier}@${definition.installVersion}`
      : specifier

    WIKI.logger.info(`Installing extension ${definition.key} (npm package ${request})...`)
    try {
      const { stdout } = await execFileAsync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        [
          'install',
          '--no-save',
          '--force',
          '--include=optional',
          '--no-ignore-scripts',
          '--no-audit',
          '--no-fund',
          request
        ],
        {
          cwd: WIKI.SERVERPATH,
          timeout: installTimeout,
          windowsHide: true,
          // -> `npm.cmd` is a batch file, which Node will not run without a shell. Nothing here comes
          //    from a request: the package name is read from a definition on disk.
          shell: process.platform === 'win32'
        }
      )
      WIKI.logger.debug(stdout.trim())
    } catch (err: any) {
      // -> npm says what went wrong on stderr, and the tail of it is the part worth passing on
      const detail: string = (err.stderr || err.stdout || err.message || '').toString().trim()
      WIKI.logger.warn(`Failed to install extension ${definition.key}:`)
      WIKI.logger.warn(detail || err)
      throw new Error(
        `npm could not install ${request}: ${detail.slice(-installErrorLength) || 'no output'}`
      )
    }

    if (!(await this.isInstalled(definition))) {
      throw new Error(
        `npm reported success but ${specifier} is still not present in node_modules. Check the server logs.`
      )
    }
    WIKI.logger.info(`Extension ${definition.key} is installed. [ OK ]`)
  }

  /**
   * Record that loading a module failed in this process, so that a later reinstall can say a restart is
   * needed rather than claim the extension is ready to use.
   */
  noteLoadFailure(specifier: string): void {
    this.loadFailures.add(specifier)
  }

  /**
   * Whether this process has already failed to load the extension's module, and therefore cannot use it
   * however healthy the files on disk now are.
   */
  hasLoadFailed(definition: ExtensionDefinition): boolean {
    return definition.detect?.type === 'module' && this.loadFailures.has(definition.detect.value)
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
