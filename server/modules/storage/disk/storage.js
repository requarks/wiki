const fs = require('fs-extra')
const path = require('path')
const tar = require('tar-fs')
const zlib = require('zlib')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const pageHelper = require('../../../helpers/page.js')
const moment = require('moment')

/* global WIKI */

/**
 * Get file extension based on content type
 */
const getFileExtension = (contentType) => {
  switch (contentType) {
    case 'markdown':
      return 'md'
    case 'html':
      return 'html'
    default:
      return 'txt'
  }
}

module.exports = {
  async activated() {
    // not used
  },
  async deactivated() {
    // not used
  },
  async init() {
    WIKI.logger.info('(STORAGE/DISK) Initializing...')
    await fs.ensureDir(this.config.path)
    WIKI.logger.info('(STORAGE/DISK) Initialization completed.')
  },
  async sync({ manual } = { manual: false }) {
    if (this.config.createDailyBackups || manual) {
      const dirPath = path.join(this.config.path, manual ? '_manual' : '_daily')
      await fs.ensureDir(dirPath)

      const dateFilename = moment().format(manual ? 'YYYYMMDD-HHmmss' : 'DD')

      WIKI.logger.info(`(STORAGE/DISK) Creating backup archive...`)
      await pipeline(
        tar.pack(this.config.path, {
          ignore: (filePath) => {
            return filePath.indexOf('_daily') >= 0 || filePath.indexOf('_manual') >= 0
          }
        }),
        zlib.createGzip(),
        fs.createWriteStream(path.join(dirPath, `wiki-${dateFilename}.tar.gz`))
      )
      WIKI.logger.info('(STORAGE/DISK) Backup archive created successfully.')
    }
  },
  async created(page) {
    WIKI.logger.info(`(STORAGE/DISK) Creating file ${page.path}...`)
    let fileName = `${page.path}.${getFileExtension(page.contentType)}`
    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.config.path, fileName)
    await fs.outputFile(filePath, page.injectMetadata(), 'utf8')
  },
  async updated(page) {
    WIKI.logger.info(`(STORAGE/DISK) Updating file ${page.path}...`)
    let fileName = `${page.path}.${getFileExtension(page.contentType)}`
    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.config.path, fileName)
    await fs.outputFile(filePath, page.injectMetadata(), 'utf8')
  },
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/DISK) Deleting file ${page.path}...`)
    let fileName = `${page.path}.${getFileExtension(page.contentType)}`
    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.config.path, fileName)
    await fs.unlink(filePath)
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/DISK) Renaming file ${page.sourcePath} to ${page.destinationPath}...`)
    let sourceFilePath = `${page.sourcePath}.${getFileExtension(page.contentType)}`
    let destinationFilePath = `${page.destinationPath}.${getFileExtension(page.contentType)}`

    if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
      sourceFilePath = `${page.localeCode}/${sourceFilePath}`
      destinationFilePath = `${page.localeCode}/${destinationFilePath}`
    }
    await fs.move(path.join(this.config.path, sourceFilePath), path.join(this.config.path, destinationFilePath), { overwrite: true })
  },

  /**
   * HANDLERS
   */
  async dump() {
    WIKI.logger.info(`(STORAGE/DISK) Dumping all content to disk...`)
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          let fileName = `${page.path}.${getFileExtension(page.contentType)}`
          if (WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode) {
            fileName = `${page.localeCode}/${fileName}`
          }
          WIKI.logger.info(`(STORAGE/DISK) Dumping ${fileName}...`)
          const filePath = path.join(this.config.path, fileName)
          await fs.outputFile(filePath, pageHelper.injectPageMetadata(page), 'utf8')
          cb()
        }
      })
    )
    WIKI.logger.info('(STORAGE/DISK) All content was dumped to disk successfully.')
  },
  async backup() {
    return this.sync({ manual: true })
  }
}
