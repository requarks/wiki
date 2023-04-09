import os from 'node:os'
import path from 'node:path'
import util from 'node:util'
import { exec as execSync } from 'node:child_process'
import fse from 'fs-extra'

const exec = util.promisify(execSync)

export default {
  key: 'puppeteer',
  title: 'Puppeteer',
  description: 'Headless chromium browser for server-side rendering. Required for generating PDF versions of pages and render content elements on the server (e.g. Mermaid diagrams)',
  async isCompatible () {
    return os.arch() === 'x64'
  },
  isInstalled: false,
  isInstallable: true,
  async check () {
    try {
      this.isInstalled = await fse.pathExists(path.join(WIKI.SERVERPATH, 'node_modules/puppeteer-core/.local-chromium'))
    } catch (err) {
      this.isInstalled = false
    }
    return this.isInstalled
  },
  async install () {
    try {
      const { stdout, stderr } = await exec('node install.js', {
        cwd: path.join(WIKI.SERVERPATH, 'node_modules/puppeteer-core'),
        timeout: 300000,
        windowsHide: true
      })
      this.isInstalled = true
      WIKI.logger.info(stdout)
      WIKI.logger.warn(stderr)
    } catch (err) {
      WIKI.logger.error(err)
    }
  }
}
