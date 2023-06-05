export async function task (payload) {
  WIKI.logger.info('Checking for latest version...')

  try {
    const resp = await fetch('https://api.github.com/repos/requarks/wiki/releases/latest').then(r => r.json())
    WIKI.logger.info(`Latest version is ${resp.tag_name}.`)
    await WIKI.db.knex('settings').where('key', 'update').update({
      value: {
        lastCheckedAt: (new Date).toISOString(),
        version: resp.tag_name,
        versionDate: resp.published_at
      }
    })

    WIKI.logger.info('Checked for latest version: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Checking for latest version: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
