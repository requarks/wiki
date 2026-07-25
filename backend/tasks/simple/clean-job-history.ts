export async function task(): Promise<void> {
  WIKI.logger.info('Cleaning scheduler job history...')

  try {
    await WIKI.models.jobs.cleanHistory()

    WIKI.logger.info('Cleaned scheduler job history: [ COMPLETED ]')
  } catch (err: any) {
    WIKI.logger.error('Cleaning scheduler job history: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
