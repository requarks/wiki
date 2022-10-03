const path = require('node:path')
const fs = require('fs-extra')
const { DateTime } = require('luxon')

module.exports = async (payload, helpers) => {
  helpers.logger.info('Purging orphaned upload files...')

  try {
    const uplTempPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
    await fs.ensureDir(uplTempPath)
    const ls = await fs.readdir(uplTempPath)
    const fifteenAgo = DateTime.now().minus({ minutes: 15 })

    for (const f of ls) {
      const stat = fs.stat(path.join(uplTempPath, f))
      if ((await stat).isFile && stat.ctime < fifteenAgo) {
        await fs.unlink(path.join(uplTempPath, f))
      }
    }

    helpers.logger.info('Purging orphaned upload files: [ COMPLETED ]')
  } catch (err) {
    helpers.logger.error('Purging orphaned upload files: [ FAILED ]')
    helpers.logger.error(err.message)
  }
}
