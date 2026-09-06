export async function task(): Promise<void> {
  WIKI.logger.info('Purging expired audit log entries...')

  try {
    const purged = await WIKI.models.auditLog.purge()

    WIKI.logger.info(`Purged ${purged} expired audit log entries: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Purging expired audit log entries: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
