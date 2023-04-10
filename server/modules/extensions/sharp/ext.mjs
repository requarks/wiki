import fse from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import util from 'node:util'
import { exec as execSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'

const exec = util.promisify(execSync)

export default {
  key: 'sharp',
  title: 'Sharp',
  description: 'Process and transform images. Required to generate thumbnails of uploaded images and perform transformations.',
  async isCompatible () {
    return os.arch() === 'x64'
  },
  isInstalled: false,
  isInstallable: true,
  async check () {
    this.isInstalled = await fse.pathExists(path.join(WIKI.SERVERPATH, 'node_modules/sharp/wiki_installed.txt'))
    return this.isInstalled
  },
  async install () {
    try {
      const { stdout, stderr } = await exec('node install/libvips && node install/dll-copy', {
        cwd: path.join(WIKI.SERVERPATH, 'node_modules/sharp'),
        timeout: 120000,
        windowsHide: true
      })
      await fse.ensureFile(path.join(WIKI.SERVERPATH, 'node_modules/sharp/wiki_installed.txt'))
      this.isInstalled = true
      WIKI.logger.info(stdout)
      WIKI.logger.warn(stderr)
    } catch (err) {
      WIKI.logger.error(err)
    }
  },
  sharp: null,
  async load () {
    if (!this.sharp) {
      this.sharp = (await import('sharp')).default
    }
  },
  /**
   * RESIZE IMAGE
   */
  async resize ({
    format = 'png',
    inputStream = null,
    inputPath = null,
    outputStream = null,
    outputPath = null,
    width = null,
    height = null,
    fit = 'cover',
    background = { r: 0, g: 0, b: 0, alpha: 0 },
    kernel = 'lanczos3'
  }) {
    await this.load()

    if (inputPath) {
      inputStream = fse.createReadStream(inputPath)
    }
    if (!inputStream) {
      throw new Error('Failed to open readable input stream for image resizing.')
    }
    if (outputPath) {
      outputStream = fse.createWriteStream(outputPath)
    }
    if (!outputStream) {
      throw new Error('Failed to open writable output stream for image resizing.')
    }

    if (format === 'svg') {
      return pipeline([inputStream, outputStream])
    } else {
      const transformer = this.sharp().resize({
        width,
        height,
        fit,
        background,
        kernel
      }).toFormat(format)

      return pipeline([inputStream, transformer, outputStream])
    }
  }
}
