import { setTimeout } from 'node:timers/promises'

export async function task (payload) {
  if (WIKI.config.update?.locales === false) {
    return
  }

  WIKI.logger.info('Fetching latest localization data...')

  try {
    const metadata = await fetch('https://github.com/requarks/wiki-locales/raw/main/locales/metadata.json').then(r => r.json())
    for (const lang of metadata.languages) {
      // -> Build filename
      const langFilenameParts = [lang.language]
      if (lang.region) {
        langFilenameParts.push(lang.region)
      }
      if (lang.script) {
        langFilenameParts.push(lang.script)
      }
      const langFilename = langFilenameParts.join('-')

      WIKI.logger.debug(`Fetching updates for language ${langFilename}...`)

      const strings = await fetch(`https://github.com/requarks/wiki-locales/raw/main/locales/${langFilename}.json`).then(r => r.json())
      if (strings) {
        await WIKI.db.knex('locales').insert({
          code: langFilename,
          name: lang.name,
          nativeName: lang.localizedName,
          language: lang.language,
          region: lang.region,
          script: lang.script,
          isRTL: lang.isRtl,
          strings
        }).onConflict('code').merge({
          strings,
          updatedAt: new Date()
        })
      }

      WIKI.logger.debug(`Updated strings for language ${langFilename}.`)

      await setTimeout(100)
    }

    WIKI.logger.info('Fetched latest localization data: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Fetching latest localization data: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
