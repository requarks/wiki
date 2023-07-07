import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'

export async function task ({ payload }) {
  WIKI.logger.info('Rebuilding search index...')

  try {
    await WIKI.ensureDb()

    let idx = 0
    await pipeline(
      WIKI.db.knex.select('id', 'title', 'description', 'localeCode', 'render', 'password').from('pages').stream(),
      new Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          idx++
          await WIKI.db.pages.updatePageSearchVector({ page })
          if (idx % 50 === 0) {
            WIKI.logger.info(`Rebuilding search index... (${idx} processed)`)
          }
          cb()
        }
      })
    )

    WIKI.logger.info('Refreshing autocomplete index...')
    await WIKI.db.pages.refreshAutocompleteIndex()

    WIKI.logger.info('Rebuilt search index: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Rebuilding search index: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
