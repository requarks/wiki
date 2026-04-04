export async function task() {
  WIKI.logger.info('Cleaning scheduler job history...')

  try {
    await WIKI.models.jobs.cleanHistory()

    WIKI.logger.info('Cleaned scheduler job history: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Cleaning scheduler job history: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
