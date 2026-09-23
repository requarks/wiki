/**
 * Drop the import sessions nobody came back for, and the blobs they staged.
 *
 * An import lives in a browser tab (`dev/specs/wkbackup.md` §9 is honest about what that costs), so a
 * tab that was closed halfway leaves an open session behind with however many gigabytes of uploaded
 * assets waiting in its staging directory for metadata that is never coming. Nothing else will ever
 * look at them.
 *
 * Daily and off the hour, alongside the other retention tasks: the cutoff is expressed in hours but
 * measured in days, so there is nothing to gain by looking more often.
 */
export async function task(): Promise<void> {
  WIKI.logger.info('Purging abandoned import sessions...')

  try {
    const purged = await WIKI.models.importer.sweepSessions()

    WIKI.logger.info(`Purged ${purged} abandoned import sessions: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Purging abandoned import sessions: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
