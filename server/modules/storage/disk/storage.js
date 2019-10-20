const fs = require('fs-extra')
const path = require('path')
const tar = require('tar-fs')
const zlib = require('zlib')
const stream = require('stream')
const _ = require('lodash')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const moment = require('moment')

const pageHelper = require('../../../helpers/page')
const commonDisk = require('./common')

/* global WIKI */

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
    WIKI.logger.info(`(STORAGE/DISK) Creating file [${page.localeCode}] ${page.path}...`)
    let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
    if (WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.config.path, fileName)
    await fs.outputFile(filePath, page.injectMetadata(), 'utf8')
  },
  async updated(page) {
    WIKI.logger.info(`(STORAGE/DISK) Updating file [${page.localeCode}] ${page.path}...`)
    let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
    if (WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.config.path, fileName)
    await fs.outputFile(filePath, page.injectMetadata(), 'utf8')
  },
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/DISK) Deleting file [${page.localeCode}] ${page.path}...`)
    let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
    if (WIKI.config.lang.code !== page.localeCode) {
      fileName = `${page.localeCode}/${fileName}`
    }
    const filePath = path.join(this.config.path, fileName)
    await fs.unlink(filePath)
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/DISK) Renaming file [${page.localeCode}] ${page.path} to [${page.destinationLocaleCode}] ${page.destinationPath}...`)

    let sourceFilePath = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
    let destinationFilePath = `${page.destinationPath}.${pageHelper.getFileExtension(page.contentType)}`

    if (WIKI.config.lang.namespacing) {
      if (WIKI.config.lang.code !== page.localeCode) {
        sourceFilePath = `${page.localeCode}/${sourceFilePath}`
      }
      if (WIKI.config.lang.code !== page.destinationLocaleCode) {
        destinationFilePath = `${page.destinationLocaleCode}/${destinationFilePath}`
      }
    }

    await fs.move(path.join(this.config.path, sourceFilePath), path.join(this.config.path, destinationFilePath), { overwrite: true })
  },
  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    WIKI.logger.info(`(STORAGE/DISK) Creating new file ${asset.path}...`)
    await fs.outputFile(path.join(this.config.path, asset.path), asset.data)
  },
  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to delete
   */
  async assetDeleted (asset) {
    WIKI.logger.info(`(STORAGE/DISK) Deleting file ${asset.path}...`)
    await fs.remove(path.join(this.config.path, asset.path))
  },
  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to rename
   */
  async assetRenamed (asset) {
    WIKI.logger.info(`(STORAGE/DISK) Renaming file from ${asset.path} to ${asset.destinationPath}...`)
    await fs.move(path.join(this.config.path, asset.path), path.join(this.config.path, asset.destinationPath), { overwrite: true })
  },

  /**
   * HANDLERS
   */
  async dump() {
    WIKI.logger.info(`(STORAGE/DISK) Dumping all content to disk...`)

    // -> Pages
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          let fileName = `${page.path}.${pageHelper.getFileExtension(page.contentType)}`
          if (WIKI.config.lang.code !== page.localeCode) {
            fileName = `${page.localeCode}/${fileName}`
          }
          WIKI.logger.info(`(STORAGE/DISK) Dumping page ${fileName}...`)
          const filePath = path.join(this.config.path, fileName)
          await fs.outputFile(filePath, pageHelper.injectPageMetadata(page), 'utf8')
          cb()
        }
      })
    )

    // -> Assets
    const assetFolders = await WIKI.models.assetFolders.getAllPaths()

    await pipeline(
      WIKI.models.knex.column('filename', 'folderId', 'data').select().from('assets').join('assetData', 'assets.id', '=', 'assetData.id').stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (asset, enc, cb) => {
          const filename = (asset.folderId && asset.folderId > 0) ? `${_.get(assetFolders, asset.folderId)}/${asset.filename}` : asset.filename
          WIKI.logger.info(`(STORAGE/DISK) Dumping asset ${filename}...`)
          await fs.outputFile(path.join(this.config.path, filename), asset.data)
          cb()
        }
      })
    )

    WIKI.logger.info('(STORAGE/DISK) All content was dumped to disk successfully.')
  },
  async backup() {
    return this.sync({ manual: true })
  },
  async importAll() {
    WIKI.logger.info(`(STORAGE/DISK) Importing all content from local disk folder to the DB...`)
    await commonDisk.importFromDisk({
      fullPath: this.config.path,
      moduleName: 'DISK'
    })
    WIKI.logger.info('(STORAGE/DISK) Import completed.')
  }
}
