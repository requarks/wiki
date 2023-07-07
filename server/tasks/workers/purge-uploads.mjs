import path from 'node:path'
import fse from 'fs-extra'
import { DateTime } from 'luxon'

export async function task ({ payload }) {
  WIKI.logger.info('Purging orphaned upload files...')

  try {
    const uplTempPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
    await fse.ensureDir(uplTempPath)
    const ls = await fse.readdir(uplTempPath)
    const fifteenAgo = DateTime.now().minus({ minutes: 15 })

    for (const f of ls) {
      const stat = fse.stat(path.join(uplTempPath, f))
      if ((await stat).isFile && stat.ctime < fifteenAgo) {
        await fse.unlink(path.join(uplTempPath, f))
      }
    }

    WIKI.logger.info('Purging orphaned upload files: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Purging orphaned upload files: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
