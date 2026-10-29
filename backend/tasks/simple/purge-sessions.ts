/**
 * Delete the sessions nobody has used for as long as a session cookie lives — see
 * `sessions.purgeExpired`. Only a logout deletes one otherwise, so every session that was simply
 * abandoned would stay in the table for good.
 */
export async function task(): Promise<void> {
  WIKI.logger.info('Purging expired sessions...')

  try {
    const purged = await WIKI.models.sessions.purgeExpired()

    WIKI.logger.info(`Purged ${purged} expired sessions: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Purging expired sessions: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
