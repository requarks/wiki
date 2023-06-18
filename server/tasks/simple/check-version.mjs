export async function task (payload) {
  WIKI.logger.info('Checking for latest version...')

  try {
    const resp = await fetch('https://api.github.com/repos/requarks/wiki/releases/latest').then(r => r.json())
    const strictVersion = resp.tag_name.indexOf('v') === 0 ? resp.tag_name.substring(1) : resp.tag_name
    WIKI.logger.info(`Latest version is ${resp.tag_name}.`)
    WIKI.config.update = {
      lastCheckedAt: (new Date).toISOString(),
      version: strictVersion,
      versionDate: resp.published_at
    }
    await WIKI.configSvc.saveToDb(['update'])

    WIKI.logger.info('Checked for latest version: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Checking for latest version: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
