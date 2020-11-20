const SSH2Promise = require('ssh2-promise')
const _ = require('lodash')
const path = require('path')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const pageHelper = require('../../../helpers/page.js')

/* global WIKI */

const getFilePath = (page, pathKey) => {
  const fileName = `${page[pathKey]}.${pageHelper.getFileExtension(page.contentType)}`
  const withLocaleCode = WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode
  return withLocaleCode ? `${page.localeCode}/${fileName}` : fileName
}

module.exports = {
  client: null,
  sftp: null,
  async activated() {

  },
  async deactivated() {

  },
  async init() {
    WIKI.logger.info(`(STORAGE/SFTP) Initializing...`)
    this.client = new SSH2Promise({
      host: this.config.host,
      port: this.config.port || 22,
      username: this.config.username,
      password: (this.config.authMode === 'password') ? this.config.password : null,
      privateKey: (this.config.authMode === 'privateKey') ? this.config.privateKey : null,
      passphrase: (this.config.authMode === 'privateKey') ? this.config.passphrase : null
    })
    await this.client.connect()
    this.sftp = this.client.sftp()
    try {
      await this.sftp.readdir(this.config.basePath)
    } catch (err) {
      WIKI.logger.warn(`(STORAGE/SFTP) ${err.message}`)
      throw new Error(`Unable to read specified base directory: ${err.message}`)
    }
    WIKI.logger.info(`(STORAGE/SFTP) Initialization completed.`)
  },
  async created(page) {
    WIKI.logger.info(`(STORAGE/SFTP) Creating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.ensureDirectory(filePath)
    await this.sftp.writeFile(path.posix.join(this.config.basePath, filePath), page.injectMetadata())
  },
  async updated(page) {
    WIKI.logger.info(`(STORAGE/SFTP) Updating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.ensureDirectory(filePath)
    await this.sftp.writeFile(path.posix.join(this.config.basePath, filePath), page.injectMetadata())
  },
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/SFTP) Deleting file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.sftp.unlink(path.posix.join(this.config.basePath, filePath))
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/SFTP) Renaming file ${page.path} to ${page.destinationPath}...`)
    let sourceFilePath = getFilePath(page, 'path')
    let destinationFilePath = getFilePath(page, 'destinationPath')
    if (WIKI.config.lang.namespacing) {
      if (WIKI.config.lang.code !== page.localeCode) {
        sourceFilePath = `${page.localeCode}/${sourceFilePath}`
      }
      if (WIKI.config.lang.code !== page.destinationLocaleCode) {
        destinationFilePath = `${page.destinationLocaleCode}/${destinationFilePath}`
      }
    }
    await this.ensureDirectory(destinationFilePath)
    await this.sftp.rename(path.posix.join(this.config.basePath, sourceFilePath), path.posix.join(this.config.basePath, destinationFilePath))
  },
  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    WIKI.logger.info(`(STORAGE/SFTP) Creating new file ${asset.path}...`)
    await this.ensureDirectory(asset.path)
    await this.sftp.writeFile(path.posix.join(this.config.basePath, asset.path), asset.data)
  },
  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to delete
   */
  async assetDeleted (asset) {
    WIKI.logger.info(`(STORAGE/SFTP) Deleting file ${asset.path}...`)
    await this.sftp.unlink(path.posix.join(this.config.basePath, asset.path))
  },
  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to rename
   */
  async assetRenamed (asset) {
    WIKI.logger.info(`(STORAGE/SFTP) Renaming file from ${asset.path} to ${asset.destinationPath}...`)
    await this.ensureDirectory(asset.destinationPath)
    await this.sftp.rename(path.posix.join(this.config.basePath, asset.path), path.posix.join(this.config.basePath, asset.destinationPath))
  },
  async getLocalLocation () {

  },
  /**
   * HANDLERS
   */
  async exportAll() {
    WIKI.logger.info(`(STORAGE/SFTP) Exporting all content to the remote server...`)

    // -> Pages
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt', 'createdAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          const filePath = getFilePath(page, 'path')
          WIKI.logger.info(`(STORAGE/SFTP) Adding page ${filePath}...`)
          await this.ensureDirectory(filePath)
          await this.sftp.writeFile(path.posix.join(this.config.basePath, filePath), pageHelper.injectPageMetadata(page))
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
          WIKI.logger.info(`(STORAGE/SFTP) Adding asset ${filename}...`)
          await this.ensureDirectory(filename)
          await this.sftp.writeFile(path.posix.join(this.config.basePath, filename), asset.data)
          cb()
        }
      })
    )

    WIKI.logger.info('(STORAGE/SFTP) All content has been pushed to the remote server.')
  },
  async ensureDirectory(filePath) {
    if (filePath.indexOf('/') >= 0) {
      try {
        const folderPaths = _.dropRight(filePath.split('/'))
        for (let i = 1; i <= folderPaths.length; i++) {
          const folderSection = _.take(folderPaths, i).join('/')
          await this.sftp.mkdir(path.posix.join(this.config.basePath, folderSection))
        }
      } catch (err) {}
    }
  }
}
