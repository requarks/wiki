import { Model } from 'objection'
import { find } from 'lodash-es'
import { stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { DateTime } from 'luxon'

/**
 * Locales model
 */
export class Locale extends Model {
  static get tableName() { return 'locales' }
  static get idColumn() { return 'code' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['code', 'name'],

      properties: {
        code: {type: 'string'},
        isRTL: {type: 'boolean', default: false},
        name: {type: 'string'},
        nativeName: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'},
        completeness: {type: 'integer'}
      }
    }
  }

  static get jsonAttributes() {
    return ['strings']
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  static async refreshFromDisk ({ force = false } = {}) {
    try {
      const localesMeta = (await import(`../locales/metadata.mjs`)).default
      WIKI.logger.info(`Found ${localesMeta.languages.length} locales: [ OK ]`)

      const dbLocales = await WIKI.db.locales.query().select('code', 'updatedAt')

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
        const dbLang = find(dbLocales, ['code', langFilename])

        // -> Get File version
        const flPath = path.join(WIKI.SERVERPATH, `locales/${langFilename}.json`)
        try {
          const flStat = await stat(flPath)
          const flUpdatedAt = DateTime.fromJSDate(flStat.mtime)

          // -> Load strings
          if (!dbLang || DateTime.fromJSDate(dbLang.updatedAt) < flUpdatedAt || force) {
            WIKI.logger.debug(`Loading locale ${langFilename} into DB...`)
            const flStrings = JSON.parse(await readFile(flPath, 'utf8'))
            await WIKI.db.locales.query().insert({
              code: langFilename,
              name: lang.name,
              nativeName: lang.localizedName,
              language: lang.language,
              region: lang.region,
              script: lang.script,
              isRTL: lang.isRtl,
              strings: flStrings
            }).onConflict('code').merge(['strings', 'updatedAt'])
          } else {
            WIKI.logger.debug(`Locale ${langFilename} is newer in the DB. Skipping disk version. [ OK ]`)
          }
        } catch (err) {
          localFilesSkipped++
          WIKI.logger.debug(`Locale ${langFilename} not found on disk. Missing strings file. [ SKIPPED ]`)
        }
      }
      if (localFilesSkipped > 0) {
        WIKI.logger.info(`${localFilesSkipped} locales were defined in the metadata file but not found on disk. [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to load locales from disk: [ FAILED ]`)
      WIKI.logger.warn(err)
      return false
    }
  }

  static async getStrings (locale) {
    const { strings } = await WIKI.db.locales.query().findOne('code', locale).column('strings')
    return strings
  }

  static async getNavLocales({ cache = false } = {}) {
    return []
    // if (!WIKI.config.lang.namespacing) {
    //   return []
    // }

    // if (cache) {
    //   const navLocalesCached = await WIKI.cache.get('nav:locales')
    //   if (navLocalesCached) {
    //     return navLocalesCached
    //   }
    // }
    // const navLocales = await WIKI.db.locales.query().select('code', 'nativeName AS name').whereIn('code', WIKI.config.lang.namespaces).orderBy('code')
    // if (navLocales) {
    //   if (cache) {
    //     await WIKI.cache.set('nav:locales', navLocales, 300)
    //   }
    //   return navLocales
    // } else {
    //   WIKI.logger.warn('Site Locales for navigation are missing or corrupted.')
    //   return []
    // }
  }
}
