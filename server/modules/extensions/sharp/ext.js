const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { pipeline } = require('stream/promises')

module.exports = {
  key: 'sharp',
  title: 'Sharp',
  description: 'Process and transform images. Required to generate thumbnails of uploaded images and perform transformations.',
  async isCompatible () {
    return os.arch() === 'x64'
  },
  isInstalled: false,
  isInstallable: true,
  async check () {
    this.isInstalled = await fs.pathExists(path.join(process.cwd(), 'node_modules/sharp/wiki_installed.txt'))
    return this.isInstalled
  },
  async install () {
    try {
      const { stdout, stderr } = await exec('node install/libvips && node install/dll-copy', {
        cwd: path.join(process.cwd(), 'node_modules/sharp'),
        timeout: 120000,
        windowsHide: true
      })
      await fs.ensureFile(path.join(process.cwd(), 'node_modules/sharp/wiki_installed.txt'))
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
      this.sharp = require('sharp')
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
    this.load()

    if (inputPath) {
      inputStream = fs.createReadStream(inputPath)
    }
    if (!inputStream) {
      throw new Error('Failed to open readable input stream for image resizing.')
    }
    if (outputPath) {
      outputStream = fs.createWriteStream(outputPath)
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
