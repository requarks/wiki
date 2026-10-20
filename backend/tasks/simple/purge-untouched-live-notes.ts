/**
 * Delete the live notes nobody has written anything in for a day — see
 * `liveNotes.purgeUntouched`. A note costs nothing to make, by visiting `/n` or any `/n/<key>`
 * nobody has used yet, so the mistakes would otherwise pile up in every creator's My Live Notes.
 */
export async function task(): Promise<void> {
  WIKI.logger.info('Purging untouched live notes...')

  try {
    const purged = await WIKI.models.liveNotes.purgeUntouched()

    WIKI.logger.info(`Purged ${purged} untouched live notes: [ COMPLETED ]`)
  } catch (err: any) {
    WIKI.logger.error('Purging untouched live notes: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
