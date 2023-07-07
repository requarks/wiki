export async function task (payload) {
  WIKI.logger.info('Refreshing autocomplete word index...')

  try {
    await WIKI.db.pages.refreshAutocompleteIndex()

    WIKI.logger.info('Refreshed autocomplete word index: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Refreshing autocomplete word index: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
