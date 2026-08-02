export async function task(): Promise<void> {
  WIKI.logger.info('Purging stale rate limit counters...')

  try {
    const purged = await WIKI.models.rateLimits.purgeStale()

    WIKI.logger.info(`Purged ${purged} stale rate limit counters: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Purging stale rate limit counters: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
