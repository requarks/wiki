const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  async init () {
    if (!WIKI.config.offline) {
      return
    }

    const sideloadExists = await fs.pathExists(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'sideload'))

    if (!sideloadExists) {
      return
    }

    WIKI.logger.info('Sideload directory detected. Looking for packages...')

    try {
      await this.importLocales()
    } catch (err) {
      WIKI.logger.warn(err)
    }
  },
  async importLocales() {
    const localeExists = await fs.pathExists(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'sideload/locales.json'))
    if (localeExists) {
      WIKI.logger.info('Found locales master file. Importing locale packages...')
      let importedLocales = 0

      const locales = await fs.readJson(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'sideload/locales.json'))
      if (locales && _.has(locales, 'data.localization.locales')) {
        for (const locale of locales.data.localization.locales) {
          try {
            const localeData = await fs.readJson(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `sideload/${locale.code}.json`))
            if (localeData) {
              WIKI.logger.info(`Importing ${locale.name} locale package...`)

              let lcObj = {}
              _.forOwn(localeData, (value, key) => {
                if (_.includes(key, '::')) { return }
                if (_.isEmpty(value)) { value = key }
                _.set(lcObj, key.replace(':', '.'), value)
              })

              const localeDbExists = await WIKI.models.locales.query().select('code').where('code', locale.code).first()
              if (localeDbExists) {
                await WIKI.models.locales.query().update({
                  code: locale.code,
                  strings: lcObj,
                  isRTL: locale.isRTL,
                  name: locale.name,
                  nativeName: locale.nativeName
                }).where('code', locale.code)
              } else {
                await WIKI.models.locales.query().insert({
                  code: locale.code,
                  strings: lcObj,
                  isRTL: locale.isRTL,
                  name: locale.name,
                  nativeName: locale.nativeName
                })
              }
              importedLocales++
            }
          } catch (err) {
            // skip
          }
        }
        WIKI.logger.info(`Imported ${importedLocales} locale packages: [COMPLETED]`)
      }
    }
  }
}
