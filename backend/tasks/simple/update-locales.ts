/**
 * Bring the locale list in step with what is published upstream.
 *
 * Scheduled nightly, and run on demand from the admin area's Fetch Locales action — which passes
 * `force`, since `update.locales: false` is there to stop the wiki phoning home on its own, not to
 * refuse an administrator who asked for this explicitly.
 */
export async function task(payload?: { force?: boolean }): Promise<void> {
  if (!payload?.force && WIKI.config.update?.locales === false) {
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
