import fs from 'node:fs/promises'
import path from 'path'

export default {
  ext: {},
  async init () {
    const extDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/extensions'))
    WIKI.logger.info(`Checking for installed optional extensions...`)
    for (const dir of extDirs) {
      WIKI.extensions.ext[dir] = (await import(path.join(WIKI.SERVERPATH, 'modules/extensions', dir, 'ext.mjs'))).default
      const isInstalled = await WIKI.extensions.ext[dir].check()
      if (isInstalled) {
        WIKI.logger.info(`Optional extension ${dir} is installed. [ OK ]`)
      } else {
        WIKI.logger.info(`Optional extension ${dir} was not found on this system. [ SKIPPED ]`)
      }
    }
  }
}
