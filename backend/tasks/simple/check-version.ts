export async function task(): Promise<void> {
  // -> Nothing to reach, and a nightly failure saying so would be noise rather than news
  if (WIKI.config.offline) {
    return
  }

  WIKI.logger.info('Checking for latest version...')

  try {
    const resp: { tag_name: string; published_at: string } = await fetch(
      'https://api.github.com/repos/requarks/wiki/releases/latest'
    ).then((r) => r.json() as Promise<{ tag_name: string; published_at: string }>)
    const strictVersion =
      resp.tag_name.indexOf('v') === 0 ? resp.tag_name.substring(1) : resp.tag_name
    WIKI.logger.info(`Latest version is ${resp.tag_name}.`)
    const latest = {
      lastCheckedAt: new Date().toISOString(),
      version: strictVersion,
      versionDate: resp.published_at
    }
    // -> Persist only the fields this task owns. `update` also carries `locales` from config.yml,
    //    which must stay in the file: written to the settings row, it would outrank config.yml on
    //    every boot and could no longer be turned back on from there.
    await WIKI.models.settings.updateConfig('update', latest)
    WIKI.config.update = { ...WIKI.config.update, ...latest }
    WIKI.events.outbound.emit('reloadConfig')

    WIKI.logger.info('Checked for latest version: [ COMPLETED ]')
  } catch (err: any) {
    WIKI.logger.error('Checking for latest version: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
