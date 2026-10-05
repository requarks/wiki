/**
 * Bring the locale list in step with what is published upstream.
 *
 * Scheduled nightly. The admin area's Fetch Locales action does the same work but does not come
 * through here: `POST /locales/fetch` calls `updateFromRemote` directly, since its dialog waits for
 * the counts. So `update.locales: false`, which is there to stop the wiki phoning home on its own,
 * never refuses an administrator who asked for this explicitly.
 */
export async function task(): Promise<void> {
  if (WIKI.config.update?.locales === false) {
    return
  }
  // -> Nothing to reach, and a nightly failure saying so would be noise rather than news
  if (WIKI.config.offline) {
    return
  }

  try {
    await WIKI.models.locales.updateFromRemote()
  } catch (err: any) {
    WIKI.logger.error('Fetching latest localization data: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
