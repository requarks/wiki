import { stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { DateTime } from 'luxon'
import { locales as localesTable } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'

/**
 * Locales model
 */
class Locales {
  async refreshFromDisk({ force = false } = {}) {
    try {
      const localesMeta = (await import('../locales/metadata.js')).default
      WIKI.logger.info(`Found ${localesMeta.languages.length} locales [ OK ]`)

      const dbLocales = await WIKI.db
        .select({
          code: localesTable.code,
          updatedAt: localesTable.updatedAt
        })
        .from(localesTable)
        .orderBy(localesTable.code)

      let localFilesSkipped = 0
      for (const lang of localesMeta.languages) {
        // -> Build filename
        const langFilenameParts = [lang.language]
        if (lang.region) {
          langFilenameParts.push(lang.region)
        }
        if (lang.script) {
          langFilenameParts.push(lang.script)
        }
        const langFilename = langFilenameParts.join('-')

        // -> Get DB version
        const dbLang = dbLocales.find((l) => l.code === langFilename)

        // -> Get File version
        const flPath = path.join(WIKI.SERVERPATH, `locales/${langFilename}.json`)
        try {
          const flStat = await stat(flPath)
          const flUpdatedAt = DateTime.fromJSDate(flStat.mtime)

          // -> Load strings
          if (!dbLang || DateTime.fromJSDate(dbLang.updatedAt) < flUpdatedAt || force) {
            WIKI.logger.info(`Loading locale ${langFilename} into DB...`)
            const flStrings = JSON.parse(await readFile(flPath, 'utf8'))
            await WIKI.db
              .insert(localesTable)
              .values({
                code: langFilename,
                name: lang.name,
                nativeName: lang.localizedName,
                language: lang.language,
                region: lang.region,
                script: lang.script,
                isRTL: lang.isRtl,
                strings: flStrings
              })
              .onConflictDoUpdate({
                target: localesTable.code,
                set: { strings: flStrings, updatedAt: sql`now()` }
              })
            WIKI.logger.info(`Locale ${langFilename} loaded successfully. [ OK ]`)
          } else {
            WIKI.logger.info(
              `Locale ${langFilename} is newer in the DB. Skipping disk version. [ OK ]`
            )
          }
        } catch {
          localFilesSkipped++
          WIKI.logger.warn(
            `Locale ${langFilename} not found on disk. Missing strings file. [ SKIPPED ]`
          )
        }
      }
      if (localFilesSkipped > 0) {
        WIKI.logger.warn(
          `${localFilesSkipped} locales were defined in the metadata file but not found on disk. [ SKIPPED ]`
        )
      }
    } catch (err) {
      WIKI.logger.warn('Failed to load locales from disk: [ FAILED ]')
      WIKI.logger.warn(err)
      return false
    }
  }

  async getLocales({ cache = true } = {}) {
    if (!WIKI.cache.has('locales') || !cache) {
      const locales = await WIKI.db
        .select({
          code: localesTable.code,
          isRTL: localesTable.isRTL,
          language: localesTable.language,
          name: localesTable.name,
          nativeName: localesTable.nativeName,
          createdAt: localesTable.createdAt,
          updatedAt: localesTable.updatedAt,
          completeness: localesTable.completeness
        })
        .from(localesTable)
        .orderBy(localesTable.code)
      WIKI.cache.set('locales', locales)
      for (const locale of locales) {
        WIKI.cache.set(`locale:${locale.code}`, locale)
      }
    }
    return WIKI.cache.get('locales')
  }

  async getStrings(locale) {
    const results = await WIKI.db
      .select({ strings: localesTable.strings })
      .from(localesTable)
      .where(eq(localesTable.code, locale))
      .limit(1)
    return results.length === 1 ? results[0].strings : []
  }

  async reloadCache() {
    WIKI.logger.info('Reloading locales cache...')
    const locales = await WIKI.models.locales.getLocales({ cache: false })
    WIKI.logger.info(`Loaded ${locales.length} locales into cache [ OK ]`)
  }
}

export const locales = new Locales()
