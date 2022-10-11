const path = require('node:path')
const fs = require('fs-extra')
const { DateTime } = require('luxon')

module.exports = async ({ payload }) => {
  WIKI.logger.info('Purging orphaned upload files...')

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

    WIKI.logger.info('Purging orphaned upload files: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Purging orphaned upload files: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
