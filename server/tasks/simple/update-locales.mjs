export async function task (payload) {
  WIKI.logger.info('Fetching latest localization data...')

  try {
    // TODO: Fetch locale updates

    WIKI.logger.info('Fetched latest localization data: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Fetching latest localization data: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
