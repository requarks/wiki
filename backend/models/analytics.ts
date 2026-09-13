import fs from 'node:fs/promises'
import path from 'node:path'
import { load } from 'js-yaml'
import { htmlEscape, parseModuleProps } from '../helpers/common.ts'
import type { ModuleProp } from '../helpers/common.ts'

/**
 * The two places a provider's markup can be asked to go.
 *
 * `head` is where nearly everything belongs — a tracking tag is loaded as early as possible so that
 * it sees the page load it is meant to be counting. `bodyStart` exists for the one thing that cannot
 * go in the head: Google Tag Manager's `<noscript>` fallback, which is an `<iframe>` and so has to be
 * in the body, immediately after it opens.
 */
const SLOTS = ['head', 'bodyStart'] as const

type Slot = (typeof SLOTS)[number]

/**
 * A placeholder in a provider's code template: `{{<context>:<prop>}}`.
 *
 * The context is how the value is written into the snippet, and it is declared in the template rather
 * than on the prop because the same value goes into different places — a Matomo server URL is a
 * JavaScript string in the tracker and an attribute in the `<noscript>` pixel beside it, and those
 * escape differently. See `resolvePlaceholder`.
 */
const PLACEHOLDER = /\{\{(js|attr|num|bool):([A-Za-z0-9_]+)\}\}/g

/**
 * What a character becomes inside a JavaScript string literal in an inline `<script>`.
 *
 * The quotes and the backslash are the obvious half — an apostrophe in a site name would otherwise
 * end the string it is in. `<`, `>` and `&` are the half that is easy to miss: the contents of a
 * `<script>` element are not parsed for entities, but the HTML parser still ends the element at
 * `</script`, and `<!--` inside one changes how the rest of it is read. Escaping the three characters
 * as `\uXXXX` keeps the value from ever meaning anything to the parser, while reading back as itself
 * in JavaScript. `\u2028` and `\u2029` are line terminators to a JavaScript parser and nothing to
 * anybody else, so an unescaped one is a syntax error nobody can see.
 */
const JS_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  "'": "\\'",
  '"': '\\"',
  '`': '\\`',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '<': '\\u003C',
  '>': '\\u003E',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
}

const JS_ESCAPE_PATTERN = /[\\'"`\n\r\t<>&\u2028\u2029]/g

/** An analytics module, as declared by its `definition.yml` and `code.yml`. */
export interface AnalyticsDefinition {
  /** Directory name under `modules/analytics`, and how a site's config addresses the provider. */
  key: string
  title: string
  description: string
  /** The provider's own site, linked from the panel beside its configuration. */
  website: string
  icon: string
  props: Record<string, ModuleProp>
  /**
   * The props that must hold a value before this provider renders anything at all.
   *
   * A tag with an empty tracking ID in it is not a tag that collects less — it is a script that
   * reports to nothing, or to whatever account an empty ID happens to resolve to at the other end. So
   * an enabled provider missing one of these is skipped, and the admin area says which field is
   * empty rather than letting the wiki serve a broken snippet.
   *
   * A prop left out of this list may legitimately be empty, e.g. an Elastic APM environment name.
   */
  requires: string[]
  /** The markup each slot contributes, before any value is substituted into it. */
  code: Record<Slot, string>
}

/** One provider as a site has it configured, which is what the admin area edits. */
export interface AnalyticsProvider {
  key: string
  title: string
  description: string
  website: string
  icon: string
  isEnabled: boolean
  props: Record<string, ModuleProp>
  config: Record<string, any>
  requires: string[]
}

/** What a client may change about one provider. */
export interface AnalyticsProviderInput {
  key: string
  isEnabled?: boolean
  config?: Record<string, any>
}

/** The markup a site contributes to every document it serves. See `injectionsFor`. */
export type AnalyticsInjections = Record<Slot, string>

/** A site with nothing configured, which is every site until somebody turns a provider on. */
const NO_INJECTIONS: AnalyticsInjections = { head: '', bodyStart: '' }

/**
 * Analytics model
 *
 * An analytics provider is one module from `modules/analytics/<key>/` turned on for one site. The
 * module is two files: a `definition.yml` declaring what it is and what it needs configured, and a
 * `code.yml` holding the markup it contributes, with `{{context:prop}}` placeholders for the values.
 * There is no third file — unlike a storage module a provider has no code to run here, since the
 * whole of what it does happens in the reader's browser.
 *
 * **The markup is served, not injected by the app.** It goes into the document the server hands out
 * (`helpers/appShell.ts`), so it is in the HTML of every response including the one a client that
 * never runs JavaScript receives. That is deliberate and is the point: several providers verify an
 * installation by fetching the page and looking for their tag, which a script the SPA adds after boot
 * would fail — and a tag added after boot also misses the load it exists to measure.
 *
 * **Configuration lives in the site's own config blob**, under `analytics.providers`, rather than in
 * a table of its own. Every request that produces a document needs it, and the site configurations
 * are already in memory on every instance (`WIKI.sites`) and already reloaded across the cluster when
 * one changes — so an analytics tag costs no query, and a saved change applies to the next request.
 *
 * **`manage:sites` is the trust boundary**, the same as for the theme's head and body injections
 * beside which this markup lands. The escaping here is about correctness rather than privilege: a
 * value has to stay inside the string or the attribute it was written into, so that an apostrophe in
 * a service name cannot break every script on the page.
 */
class Analytics {
  /** Definitions read from disk, refreshed by `refreshFromDisk()`. */
  definitions: AnalyticsDefinition[] = []

  /**
   * Load the analytics module definitions from disk.
   *
   * One directory per provider, each with both files. A directory missing either is skipped with a
   * warning rather than taking the rest down with it: a provider that cannot be read is one provider
   * nobody can turn on, where an empty list would silently stop every site's existing tags.
   */
  async refreshFromDisk(): Promise<void> {
    const analyticsPath = path.join(WIKI.SERVERPATH, 'modules/analytics')
    const definitions: AnalyticsDefinition[] = []
    try {
      for (const dir of await fs.readdir(analyticsPath)) {
        try {
          const parsed = load(
            await fs.readFile(path.join(analyticsPath, dir, 'definition.yml'), 'utf8')
          ) as Record<string, any>
          const code = load(
            await fs.readFile(path.join(analyticsPath, dir, 'code.yml'), 'utf8')
          ) as Record<string, any>
          definitions.push({
            // -> The directory name is the key, as it is for every other module type
            key: dir,
            title: parsed.title ?? dir,
            description: parsed.description ?? '',
            website: parsed.website ?? '',
            icon: parsed.icon ?? '',
            // -> Props carry a display `order`, applied once here so that every consumer reads them
            //    in the order the module meant them to be shown in
            props: Object.fromEntries(
              Object.entries(parseModuleProps(parsed.props ?? {})).sort(
                ([, a], [, b]) => a.order - b.order
              )
            ),
            requires: parsed.requires ?? [],
            code: {
              head: typeof code?.head === 'string' ? code.head.trim() : '',
              bodyStart: typeof code?.bodyStart === 'string' ? code.bodyStart.trim() : ''
            }
          })
        } catch (err: any) {
          WIKI.logger.warn(`Skipping analytics module ${dir}: ${err.message}`)
        }
      }
      this.definitions = definitions.sort((a, b) => a.title.localeCompare(b.title))
      WIKI.logger.info(`Found ${this.definitions.length} analytics modules [ OK ]`)
    } catch (err: any) {
      this.definitions = []
      WIKI.logger.error(
        `Could not read the analytics module definitions at ${analyticsPath} [ FAILED ]`
      )
      WIKI.logger.error(err.message)
    }
  }

  /** A single definition, or null when nothing on disk declares that key. */
  getDefinition(key: string): AnalyticsDefinition | null {
    return this.definitions.find((d) => d.key === key) ?? null
  }

  /** What a site has stored, keyed by module. Empty for a site that has never saved this screen. */
  storedProviders(siteId: string): Record<string, { isEnabled?: boolean; config?: any }> {
    return WIKI.sites[siteId]?.config?.analytics?.providers ?? {}
  }

  /**
   * Every provider installed on disk, with what this site has configured for it merged in.
   *
   * Driven by the definitions rather than by what is stored, so a provider that has never been
   * touched is listed with its defaults and one dropped from disk simply stops appearing — its stored
   * values stay in the site config, harmless and ignored, until the screen is next saved.
   */
  getSiteProviders(siteId: string): AnalyticsProvider[] {
    const stored = this.storedProviders(siteId)
    return this.definitions.map((definition) => ({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      website: definition.website,
      icon: definition.icon,
      requires: definition.requires,
      isEnabled: stored[definition.key]?.isEnabled === true,
      props: definition.props,
      config: this.buildConfig(definition.key, {}, stored[definition.key]?.config ?? {})
    }))
  }

  /**
   * Merge incoming config values onto the ones already stored, keeping only what the module declares.
   *
   * Unknown keys are dropped rather than refused, so a provider that loses a prop does not make the
   * screen unsaveable. Read-only props are never taken from the client — the same rule the storage
   * and authentication forms follow.
   *
   * There is no sensitive-prop handling here, and there is no `maskSensitiveProps` on the route
   * either: every value on this screen is rendered into a document served to the public, so a prop
   * that had to be kept out of a browser could not be used by a provider in the first place.
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
   * Check an incoming provider patch against what the module declares.
   *
   * The props are a runtime declaration read from a YAML file, so no JSON Schema can cover them.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validateProvider(patch: AnalyticsProviderInput): string | null {
    const definition = this.getDefinition(patch.key)
    if (!definition) {
      return `There is no analytics provider called "${patch.key}".`
    }
    for (const [key, value] of Object.entries(patch.config ?? {})) {
      const prop = definition.props[key]
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
   * Write the providers a client sent, leaving the ones it did not mention alone.
   *
   * One write for the lot: this goes into the site's config blob, and `sites.updateSite` is what
   * reloads the cache on every instance and drops the app shell fragments — without which a tag
   * turned on would not appear until the next restart.
   */
  async updateSiteProviders(siteId: string, patches: AnalyticsProviderInput[]): Promise<number> {
    const stored = this.storedProviders(siteId)
    const providers: Record<string, { isEnabled: boolean; config: Record<string, any> }> = {}
    for (const patch of patches) {
      providers[patch.key] = {
        isEnabled: patch.isEnabled ?? stored[patch.key]?.isEnabled === true,
        config: this.buildConfig(patch.key, patch.config ?? {}, stored[patch.key]?.config ?? {})
      }
    }
    if (Object.keys(providers).length < 1) {
      return 0
    }
    await WIKI.models.sites.updateSite(siteId, { config: { analytics: { providers } } })
    return Object.keys(providers).length
  }

  /**
   * The markup every document this site serves carries, one string per slot.
   *
   * Read off the cached site config, so this costs nothing and is current on every instance the
   * moment the screen is saved — the same reasoning as the theme injections it lands beside. Nothing
   * here varies by requester, by page or by session, which is why it can be built per request without
   * a cache of its own and why it is not part of the fragments that are cached per URL.
   */
  injectionsFor(siteId: string | undefined): AnalyticsInjections {
    if (!siteId) {
      return NO_INJECTIONS
    }
    const stored = this.storedProviders(siteId)
    const parts: Record<Slot, string[]> = { head: [], bodyStart: [] }
    for (const definition of this.definitions) {
      if (stored[definition.key]?.isEnabled !== true) {
        continue
      }
      const config = this.buildConfig(definition.key, {}, stored[definition.key]?.config ?? {})
      if (this.missingRequired(definition, config).length > 0) {
        continue
      }
      for (const slot of SLOTS) {
        const rendered = renderTemplate(definition.code[slot], config)
        if (rendered !== null && rendered.length > 0) {
          parts[slot].push(rendered)
        }
      }
    }
    return {
      head: parts.head.join('\n  '),
      bodyStart: parts.bodyStart.join('\n')
    }
  }

  /**
   * Which of a provider's required props are empty, in declaration order.
   *
   * The same question the admin area asks of the form in front of it, so that "Google Analytics is
   * enabled but has no measurement ID" is something an administrator reads on the screen rather than
   * discovering from a tag that never fires.
   */
  missingRequired(definition: AnalyticsDefinition, config: Record<string, any>): string[] {
    return definition.requires.filter((key) => {
      const value = config[key]
      return value === undefined || value === null || `${value}`.trim().length < 1
    })
  }
}

/**
 * A value as it is written into a JavaScript string literal. See `JS_ESCAPES`.
 */
function jsEscape(value: string): string {
  return value.replace(JS_ESCAPE_PATTERN, (char) => JS_ESCAPES[char]!)
}

/**
 * Substitute a provider's configured values into one of its templates.
 *
 * @returns The markup, or null where a placeholder could not be resolved to something that would
 *   parse — a `num` slot is a bare numeric literal, so a value that is not a number would produce a
 *   syntax error taking every other script on the page with it. A template that resolves to nothing
 *   is skipped rather than emitted broken.
 */
function renderTemplate(template: string, config: Record<string, any>): string | null {
  if (!template) {
    return ''
  }
  let usable = true
  const rendered = template.replace(PLACEHOLDER, (_match, context: string, key: string) => {
    const value = config[key]
    switch (context) {
      case 'num': {
        const num = Number(value)
        if (!Number.isFinite(num)) {
          usable = false
          return '0'
        }
        return `${num}`
      }
      case 'bool':
        return value === true ? 'true' : 'false'
      case 'attr':
        return htmlEscape(`${value ?? ''}`)
      default:
        return jsEscape(`${value ?? ''}`)
    }
  })
  return usable ? rendered : null
}

export const analytics = new Analytics()
