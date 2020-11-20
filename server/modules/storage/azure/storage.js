const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const pageHelper = require('../../../helpers/page.js')
const _ = require('lodash')

/* global WIKI */

const getFilePath = (page, pathKey) => {
  const fileName = `${page[pathKey]}.${pageHelper.getFileExtension(page.contentType)}`
  const withLocaleCode = WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode
  return withLocaleCode ? `${page.localeCode}/${fileName}` : fileName
}

module.exports = {
  async activated() {

  },
  async deactivated() {

  },
  async init() {
    WIKI.logger.info(`(STORAGE/AZURE) Initializing...`)
    const { accountName, accountKey, containerName } = this.config
    this.client = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      new StorageSharedKeyCredential(accountName, accountKey)
    )
    this.container = this.client.getContainerClient(containerName)
    try {
      await this.container.create()
    } catch (err) {
      if (err.statusCode !== 409) {
        WIKI.logger.warn(err)
        throw err
      }
    }
    WIKI.logger.info(`(STORAGE/AZURE) Initialization completed.`)
  },
  async created (page) {
    WIKI.logger.info(`(STORAGE/AZURE) Creating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    const pageContent = page.injectMetadata()
    const blockBlobClient = this.container.getBlockBlobClient(filePath)
    await blockBlobClient.upload(pageContent, pageContent.length, { tier: this.config.storageTier })
  },
  async updated (page) {
    WIKI.logger.info(`(STORAGE/AZURE) Updating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    const pageContent = page.injectMetadata()
    const blockBlobClient = this.container.getBlockBlobClient(filePath)
    await blockBlobClient.upload(pageContent, pageContent.length, { tier: this.config.storageTier })
  },
  async deleted (page) {
    WIKI.logger.info(`(STORAGE/AZURE) Deleting file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    const blockBlobClient = this.container.getBlockBlobClient(filePath)
    await blockBlobClient.delete({
      deleteSnapshots: 'include'
    })
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Renaming file ${page.path} to ${page.destinationPath}...`)
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
    const sourceBlockBlobClient = this.container.getBlockBlobClient(sourceFilePath)
    const destBlockBlobClient = this.container.getBlockBlobClient(destinationFilePath)
    await destBlockBlobClient.syncCopyFromURL(sourceBlockBlobClient.url)
    await sourceBlockBlobClient.delete({
      deleteSnapshots: 'include'
    })
  },
  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    WIKI.logger.info(`(STORAGE/AZURE) Creating new file ${asset.path}...`)
    const blockBlobClient = this.container.getBlockBlobClient(asset.path)
    await blockBlobClient.upload(asset.data, asset.data.length, { tier: this.config.storageTier })
  },
  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to delete
   */
  async assetDeleted (asset) {
    WIKI.logger.info(`(STORAGE/AZURE) Deleting file ${asset.path}...`)
    const blockBlobClient = this.container.getBlockBlobClient(asset.path)
    await blockBlobClient.delete({
      deleteSnapshots: 'include'
    })
  },
  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to rename
   */
  async assetRenamed (asset) {
    WIKI.logger.info(`(STORAGE/AZURE) Renaming file from ${asset.path} to ${asset.destinationPath}...`)
    const sourceBlockBlobClient = this.container.getBlockBlobClient(asset.path)
    const destBlockBlobClient = this.container.getBlockBlobClient(asset.destinationPath)
    await destBlockBlobClient.syncCopyFromURL(sourceBlockBlobClient.url)
    await sourceBlockBlobClient.delete({
      deleteSnapshots: 'include'
    })
  },
  async getLocalLocation () {

  },
  /**
   * HANDLERS
   */
  async exportAll() {
    WIKI.logger.info(`(STORAGE/AZURE) Exporting all content to Azure Blob Storage...`)

    // -> Pages
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt', 'createdAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          const filePath = getFilePath(page, 'path')
          WIKI.logger.info(`(STORAGE/AZURE) Adding page ${filePath}...`)
          const pageContent = pageHelper.injectPageMetadata(page)
          const blockBlobClient = this.container.getBlockBlobClient(filePath)
          await blockBlobClient.upload(pageContent, pageContent.length, { tier: this.config.storageTier })
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
          WIKI.logger.info(`(STORAGE/AZURE) Adding asset ${filename}...`)
          const blockBlobClient = this.container.getBlockBlobClient(filename)
          await blockBlobClient.upload(asset.data, asset.data.length, { tier: this.config.storageTier })
          cb()
        }
      })
    )

    WIKI.logger.info('(STORAGE/AZURE) All content has been pushed to Azure Blob Storage.')
  }
}
