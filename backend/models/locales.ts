import { readdir, stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { locales as localesTable } from '../db/schema.ts'
import { eq, sql } from 'drizzle-orm'

/** Where the locale packages published for this major version live. */
const REMOTE_BASE_URL = 'https://github.com/requarks/wiki-locales/raw/main'

/**
 * The locale this wiki's strings are WRITTEN in, as opposed to translated into.
 *
 * `locales/en.json` is the source: every string in the interface is added there first, and every
 * other locale is a translation of it. That makes it the one locale the copy on disk is more
 * authoritative than anything else — so it is loaded on every boot rather than only when the file
 * looks newer, and it is never fetched from upstream, where it would be whatever was published for
 * the last release rather than what this build actually says.
 *
 * The practical failure this avoids: a string added to `en.json` in a build was invisible to a wiki
 * whose `en` row had been touched more recently — by an earlier update run, or by an administrator
 * naming it — leaving the interface showing raw keys for anything new.
 */
const SOURCE_LOCALE = 'en'

/** One entry of the remote `metadata.json`: a strings file and the hash of its contents. */
interface RemoteLocale {
  file: string
  hash: string
}

/** What an update run did, for the admin area to report. */
export interface LocaleUpdateResult {
  added: number
  updated: number
  unchanged: number
  failed: number
}

/**
 * How every locale name in the wiki is built.
 *
 * `languageDisplay: 'standard'` is what puts the language first — "Portuguese (Brazil)" rather than
 * Intl's default "Brazilian Portuguese" — so that every variant of a language sorts together in an
 * alphabetical list instead of hiding under whatever adjective happens to name it. It changes only
 * the handful of tags Intl has a dialect name for: `pt-BR`, `pt-PT` and `en-US`. `zh-TW` was already
 * "Chinese (Taiwan)".
 */
const NAME_OPTIONS = { type: 'language', languageDisplay: 'standard' } as const

/**
 * Everything a locale row needs but its strings, derived from the language tag it is named for.
 *
 * The file name IS the identity — `en`, `en-US`, `zh-Hant` — and is used verbatim as the row's
 * `code`, so that it round-trips to the remote file the strings came from. Deliberately not
 * canonicalized through `Intl.Locale.baseName`: upstream ships `sr-CS.json`, which canonicalizes to
 * `sr-RS`, and a code that no longer names a file cannot be fetched again.
 *
 * Throws `RangeError` for a name that is not a structurally valid language tag.
 */
function localeInfoFor(code: string) {
  const locale = new Intl.Locale(code)
  return {
    name: new Intl.DisplayNames(['en'], NAME_OPTIONS).of(code) ?? code,
    nativeName: new Intl.DisplayNames([code], NAME_OPTIONS).of(code) ?? code,
    language: locale.language,
    region: locale.region ?? '',
    script: locale.script ?? '',
    isRTL: locale.getTextInfo().direction === 'rtl'
  }
}

/** A locale row, as far as naming it for a list is concerned. */
interface NameableLocale {
  code: string
  language: string
  name: string
  nativeName: string
  customCode?: string | null
  customName?: string | null
  derivedCode?: string
  displayCode?: string
  displayName?: string
}

/**
 * Describe each locale of a list as precisely as that list requires, in place.
 *
 * `Intl` names a tag as precisely as the tag itself is, so `de-DE` is "German (Germany)" — a
 * qualifier that is pure noise on a list where German appears once. It stops being noise the moment
 * a second locale shares the base language: `zh-CN` beside `zh-TW`, `pt-BR` beside `pt-PT`. So a
 * language that appears once is described by its language subtag alone — "German", `de` — and one
 * that appears more than once by the whole tag.
 *
 * That covers the code shown beside the name as well, which is why `displayCode` is resolved here
 * rather than stored: `code` is the identity — the primary key, what a site's active locales name,
 * what a page's `locale` holds, and what round-trips to the remote strings file — and it cannot
 * shorten, because installing `fr-CA` next to `fr-FR` would have to rename it and take every page
 * and URL with it. An administrator's `customCode` overrides the derived form and nothing else: the
 * names still come from the tag, so calling `zh-CN` "cn" does not make it Cantonese.
 *
 * `displayName` is the single line to show wherever a locale is offered rather than described — a
 * selector, as opposed to the admin list that names it three ways. It is the native name, because a
 * reader picking their own language should meet it spelled the way they spell it, unless an
 * administrator named it something else.
 */
function resolveDisplayNames(locales: NameableLocale[]) {
  const perLanguage = new Map<string, number>()
  for (const lc of locales) {
    perLanguage.set(lc.language, (perLanguage.get(lc.language) ?? 0) + 1)
  }
  const englishNames = new Intl.DisplayNames(['en'], NAME_OPTIONS)
  for (const lc of locales) {
    const subject = perLanguage.get(lc.language) === 1 ? lc.language : lc.code
    // -> Both, because the admin area has to be able to say what clearing the override would leave
    lc.derivedCode = subject
    lc.displayCode = lc.customCode || subject
    lc.name = englishNames.of(subject) ?? lc.name
    lc.nativeName = new Intl.DisplayNames([lc.code], NAME_OPTIONS).of(subject) ?? lc.nativeName
    lc.displayName = lc.customName || lc.nativeName
  }
}

/**
 * Locales model
 *
 * A locale row is either **installed** — it holds a string set and can be served — or merely
 * **available**, which is a row the update task created from the remote metadata so that the locale
 * can be offered without its strings having been downloaded. `isInstalled` is the difference, and
 * only an installed locale may be activated on a site.
 *
 * Two sources fill those rows, and they do not overlap: `locales/en.json` on disk, which is where the
 * interface's strings are written, and the published packages every translation comes from. See
 * `SOURCE_LOCALE` for why the first is never asked of the second.
 */
class Locales {
  /**
   * Load every locale strings file shipped in `locales/` into the db.
   *
   * The directory is the list: a `<tag>.json` in it is a locale the wiki has, and there is no
   * manifest to keep in step with it. Everything the row needs but the strings comes off the file
   * name through `Intl` — see `localeInfoFor`. A file whose name is not a valid language tag is
   * skipped rather than failing the run.
   *
   * A file is only loaded when it is newer than the row, unless `force` is set: a locale that was
   * updated in the db — by the update task, or by an administrator — must not be overwritten by the
   * copy that shipped with the release. The `hash` is left empty either way, since these strings did
   * not come from the remote metadata; that is what makes the first update run consider them stale.
   *
   * **`en` is exempt and always loaded**, because it is not a translation of anything — see
   * `SOURCE_LOCALE`. Only the strings are written, so an administrator's `customName` or `customCode`
   * survives the reload.
   */
  async refreshFromDisk({ force = false }: { force?: boolean } = {}): Promise<false | void> {
    try {
      const localesPath = path.join(WIKI.SERVERPATH, 'locales')
      const localeFiles = (await readdir(localesPath)).filter((fl) => fl.endsWith('.json'))
      WIKI.logger.info(`Found ${localeFiles.length} locales [ OK ]`)

      const dbLocales = await WIKI.db
        .select({
          code: localesTable.code,
          updatedAt: localesTable.updatedAt
        })
        .from(localesTable)
        .orderBy(localesTable.code)

      for (const localeFile of localeFiles) {
        const code = path.basename(localeFile, '.json')

        // -> Read the tag off the file name
        let localeInfo: ReturnType<typeof localeInfoFor>
        try {
          localeInfo = localeInfoFor(code)
        } catch {
          WIKI.logger.warn(`Locale file ${localeFile} is not a valid language tag. [ SKIPPED ]`)
          continue
        }

        /*
          Skip a locale that was updated in the DB after the file was last written -- except the
          source locale, whose file is the authority on what the interface says and is therefore
          loaded every time. Its mtime is not even read: a checkout, a container build or a copy can
          leave the shipped file older than a row it must still replace.
        */
        const flPath = path.join(localesPath, localeFile)
        const flUpdatedAt = (await stat(flPath)).mtime.toTemporalInstant()
        const dbLang = dbLocales.find((l) => l.code === code)
        if (
          dbLang &&
          !force &&
          code !== SOURCE_LOCALE &&
          Temporal.Instant.compare(dbLang.updatedAt.toTemporalInstant(), flUpdatedAt) >= 0
        ) {
          WIKI.logger.info(`Locale ${code} is newer in the DB. Skipping disk version. [ OK ]`)
          continue
        }

        // -> Load strings
        WIKI.logger.info(`Loading locale ${code} into DB...`)
        const flStrings = JSON.parse(await readFile(flPath, 'utf8'))
        await WIKI.db
          .insert(localesTable)
          .values({
            code,
            ...localeInfo,
            isInstalled: true,
            strings: flStrings
          })
          .onConflictDoUpdate({
            target: localesTable.code,
            /*
              The hash is cleared, not kept: these strings did not come from the remote file it was
              recorded for, so leaving it would tell the next update run that a locale it has never
              actually delivered is already up to date.
            */
            set: { strings: flStrings, isInstalled: true, hash: '', updatedAt: sql`now()` }
          })
        WIKI.logger.info(`Locale ${code} loaded successfully. [ OK ]`)
      }
    } catch (err: any) {
      WIKI.logger.warn('Failed to load locales from disk: [ FAILED ]')
      WIKI.logger.warn(err)
      return false
    }
  }

  /**
   * Read the list of locale packages published upstream.
   */
  async fetchRemoteMetadata(): Promise<RemoteLocale[]> {
    const resp = await fetch(`${REMOTE_BASE_URL}/metadata.json`)
    if (!resp.ok) {
      throw new Error(`Remote locale metadata could not be fetched (HTTP ${resp.status}).`)
    }
    const metadata = (await resp.json()) as RemoteLocale[]
    if (!Array.isArray(metadata)) {
      throw new Error('Remote locale metadata is not in the expected format.')
    }
    return metadata
  }

  /**
   * Download one locale's strings and store them against its remote hash.
   */
  async #installRemote(entry: RemoteLocale, code: string): Promise<void> {
    const resp = await fetch(`${REMOTE_BASE_URL}/${entry.file}`)
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }
    const strings = await resp.json()
    await WIKI.db
      .insert(localesTable)
      .values({
        code,
        ...localeInfoFor(code),
        isInstalled: true,
        hash: entry.hash,
        strings
      })
      .onConflictDoUpdate({
        target: localesTable.code,
        set: { strings, isInstalled: true, hash: entry.hash, updatedAt: sql`now()` }
      })
  }

  /**
   * Bring the locale list in step with what is published upstream.
   *
   * Two different things happen, and the split is what keeps this cheap: a locale nobody has
   * installed gets a **row only**, so that it can be offered in the admin area, while an installed
   * one has its strings re-downloaded — but only when the remote hash differs from the one stored,
   * which is the whole point of keeping it. A locale that came off disk has an empty hash, so its
   * first update run fetches it and records the hash from then on.
   *
   * A locale that fails is counted and logged rather than taking the rest of the run down with it:
   * one unreachable file should not leave the other fifty stale.
   *
   * **The source locale is left alone entirely** — see `SOURCE_LOCALE`. Upstream publishes an `en`
   * package like any other, and it holds the strings of whatever release it was built from; taking it
   * would overwrite the ones this build ships with, which is how an interface ends up missing the
   * strings for its own features. It is counted as unchanged, because from the run's point of view
   * there was nothing to do.
   */
  async updateFromRemote(): Promise<LocaleUpdateResult> {
    WIKI.logger.info('Fetching latest localization data...')
    const metadata = await this.fetchRemoteMetadata()

    const dbLocales = await WIKI.db
      .select({
        code: localesTable.code,
        hash: localesTable.hash,
        isInstalled: localesTable.isInstalled
      })
      .from(localesTable)

    const result: LocaleUpdateResult = { added: 0, updated: 0, unchanged: 0, failed: 0 }
    for (const entry of metadata) {
      const code = path.basename(entry.file, '.json')
      if (code === SOURCE_LOCALE) {
        result.unchanged++
        continue
      }
      try {
        const localeInfo = localeInfoFor(code)
        const dbLang = dbLocales.find((l) => l.code === code)

        // -> Not seen before: record it as available, without paying for strings nobody asked for
        if (!dbLang) {
          await WIKI.db.insert(localesTable).values({ code, ...localeInfo })
          result.added++
          continue
        }

        // -> Available but not installed, or installed and already holding this exact file
        if (!dbLang.isInstalled || dbLang.hash === entry.hash) {
          result.unchanged++
          continue
        }

        WIKI.logger.info(`Updating locale ${code}...`)
        await this.#installRemote(entry, code)
        result.updated++
      } catch (err: any) {
        WIKI.logger.warn(`Failed to update locale ${code}: ${err.message} [ FAILED ]`)
        result.failed++
      }
    }

    if (result.added > 0 || result.updated > 0) {
      await this.reloadCache()
      WIKI.events.outbound.emit('reloadLocales')
    }
    WIKI.logger.info(
      `Fetched latest localization data: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged, ${result.failed} failed. [ COMPLETED ]`
    )
    return result
  }

  /**
   * Download the strings of an available locale, making it installable on a site.
   *
   * The remote metadata is read again rather than trusted from the last update run, so that the
   * hash recorded is the one the downloaded file was published with.
   */
  async install(code: string): Promise<void> {
    // -> There is nothing to install: it ships with the wiki and is loaded from disk on every boot,
    //    and downloading over it would replace this build's strings with an older release's
    if (code === SOURCE_LOCALE) {
      throw new Error(`Locale ${code} ships with the wiki and cannot be downloaded.`)
    }
    const metadata = await this.fetchRemoteMetadata()
    const entry = metadata.find((e) => path.basename(e.file, '.json') === code)
    if (!entry) {
      throw new Error(`Locale ${code} is not published upstream.`)
    }
    WIKI.logger.info(`Installing locale ${code}...`)
    await this.#installRemote(entry, code)
    await this.reloadCache()
    WIKI.events.outbound.emit('reloadLocales')
    WIKI.logger.info(`Locale ${code} installed successfully. [ OK ]`)
  }

  /**
   * Set — or, with empty values, clear — what a locale is called and what it is addressed as.
   *
   * The two are held to different standards because they answer to different things. A name is a
   * label: anything non-empty will do, and two locales reading alike is somebody's choice. A code is
   * an identifier: it has to be a language tag, and it is refused when it is already how some other
   * locale is addressed, since an alias colliding with another row's `code` or shown code makes the
   * two indistinguishable in a list and a locale-prefixed path ambiguous.
   *
   * Clearing either one puts its derived form back.
   */
  async setAliases(
    code: string,
    { customName, customCode }: { customName?: string | null; customCode?: string | null }
  ): Promise<void> {
    const locales = await this.getLocales()
    const target = locales.find((lc: any) => lc.code === code)
    if (!target) {
      throw new Error(`Locale ${code} does not exist.`)
    }

    let nextCode = customCode?.trim() || null
    if (nextCode) {
      try {
        new Intl.Locale(nextCode)
      } catch {
        throw new Error(`"${nextCode}" is not a valid language code.`)
      }
      if (nextCode === target.derivedCode) {
        /*
          Storing what would be derived anyway pins it. `fr-FR` shows as `fr` on its own, but
          installing `fr-CA` has to lengthen it back to `fr-FR` — which it cannot do with `fr`
          written into the row. Asking for the default is asking for no override, so this is how
          the admin area can offer the derived form as the field's starting value without a save
          that changes nothing quietly freezing it.
        */
        nextCode = null
      } else if (
        locales.some(
          (lc: any) =>
            lc.code !== code &&
            (lc.code === nextCode ||
              lc.displayCode === nextCode ||
              // -> Its derived code too, which is a folder its content may still be sitting in even
              //    though nothing shows that code any more. Taking the name would make a stored path
              //    ambiguous between the two locales.
              lc.derivedCode === nextCode)
        )
      ) {
        throw new Error(`"${nextCode}" is already used by another locale.`)
      }
    }

    // -> Same reasoning as the code: the derived name written into the row is an override that
    //    stops following the tag, so asking for it is asking for none
    let nextName = customName?.trim() || null
    if (nextName === target.nativeName) {
      nextName = null
    }

    await WIKI.db
      .update(localesTable)
      .set({ customCode: nextCode, customName: nextName })
      .where(eq(localesTable.code, code))

    await this.reloadCache()
    WIKI.events.outbound.emit('reloadLocales')
  }

  /**
   * The locale list as the cache holds it, for the callers that cannot await.
   *
   * Empty before `reloadCache` has run, which for the storage layout means falling back to the raw
   * code — the same path the wiki wrote before aliases existed, rather than a wrong one.
   */
  #cachedLocales(): any[] {
    return (WIKI.cache?.get('locales') as any[]) ?? []
  }

  /**
   * The short code a locale is addressed by: its alias where it has one.
   *
   * The segment a storage target files its content under and the one a locale-prefixed URL starts
   * with are the same answer, which is why this is not named for either. Sync, because both callers
   * are: `pathPrefixFor` is not async, and neither is the request hook that redirects a page URL.
   */
  shortCodeFor(code: string): string {
    return (WIKI.cache?.get(`locale:${code}`) as any)?.displayCode ?? code
  }

  /**
   * The locale a short code names, whichever of its codes was used.
   *
   * All three are accepted because all three can be in play at once: an alias set after content was
   * written leaves the old folder exactly where it was, so `fr-FR` aliased to `fra` may have a `fra/`
   * beside a `fr/` it filled while the short code was still derived, and a `fr-FR/` from before short
   * codes. Reading each of them back to the same locale is what keeps a later import from adopting
   * the old folder as a locale of its own — which is how `notes/trois` ends up existing twice — and
   * what keeps a link someone saved from breaking when the alias changes. `setAliases` keeps the
   * three sets disjoint, so a segment names at most one locale, and one that names none is passed
   * through: a folder the wiki has never heard of reads as it always did.
   */
  localeForShortCode(segment: string): string {
    const locales = this.#cachedLocales()
    const match =
      locales.find((lc) => lc.code === segment) ??
      locales.find((lc) => lc.displayCode === segment || lc.derivedCode === segment)
    return match?.code ?? segment
  }

  async getLocales({ cache = true }: { cache?: boolean } = {}): Promise<any[]> {
    if (!WIKI.cache.has('locales') || !cache) {
      const locales = await WIKI.db
        .select({
          code: localesTable.code,
          isRTL: localesTable.isRTL,
          isInstalled: localesTable.isInstalled,
          language: localesTable.language,
          name: localesTable.name,
          nativeName: localesTable.nativeName,
          customCode: localesTable.customCode,
          customName: localesTable.customName,
          createdAt: localesTable.createdAt,
          updatedAt: localesTable.updatedAt,
          completeness: localesTable.completeness
        })
        .from(localesTable)
        .orderBy(localesTable.code)
      resolveDisplayNames(locales)
      WIKI.cache.set('locales', locales)
      for (const locale of locales) {
        WIKI.cache.set(`locale:${locale.code}`, locale)
      }
    }
    return WIKI.cache.get('locales') as any[]
  }

  /** The locales that hold a string set, which are the only ones a site may activate. */
  async getInstalledLocales({ cache = true }: { cache?: boolean } = {}): Promise<any[]> {
    return (await this.getLocales({ cache })).filter((lc) => lc.isInstalled)
  }

  async getStrings(locale: string) {
    const results = await WIKI.db
      .select({ strings: localesTable.strings })
      .from(localesTable)
      .where(eq(localesTable.code, locale))
      .limit(1)
    return results.length === 1 ? results[0].strings : []
  }

  async reloadCache(): Promise<void> {
    WIKI.logger.info('Reloading locales cache...')
    const locales = await WIKI.models.locales.getLocales({ cache: false })
    WIKI.logger.info(`Loaded ${locales.length} locales into cache [ OK ]`)
  }
}

export const locales = new Locales()
