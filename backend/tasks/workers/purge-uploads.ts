import path from 'node:path'
import fse from 'fs-extra'

export async function task(): Promise<void> {
  WIKI.logger.info('Purging orphaned upload files...')

  try {
    const uplTempPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
    await fse.ensureDir(uplTempPath)
    const ls = await fse.readdir(uplTempPath)
    const fifteenAgo = Temporal.Now.instant().subtract({ minutes: 15 })

    for (const f of ls) {
      const stat = await fse.stat(path.join(uplTempPath, f))
      // -> Compared as epoch millis. Temporal deliberately has no `valueOf`, so relational
      //    operators on its types throw — comparisons must be explicit.
      if (stat.isFile() && stat.ctime.getTime() < fifteenAgo.epochMilliseconds) {
        await fse.unlink(path.join(uplTempPath, f))
      }
    }

    WIKI.logger.info('Purging orphaned upload files: [ COMPLETED ]')
  } catch (err: any) {
    WIKI.logger.error('Purging orphaned upload files: [ FAILED ]')
    WIKI.logger.error(err.message)
    throw err
  }
}
