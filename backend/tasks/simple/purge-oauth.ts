/**
 * Drop what the OAuth flow leaves behind — codes nobody exchanged, and clients no grant ever named
 * once they are a day old. See `oauth.purge`. Registration is open, so this is what keeps it cheap.
 */
export async function task(): Promise<void> {
  WIKI.logger.info('Purging unused OAuth clients and codes...')

  try {
    const purged = await WIKI.models.oauth.purge()

    WIKI.logger.info(`Purged ${purged} unused OAuth clients: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Purging unused OAuth clients and codes: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
