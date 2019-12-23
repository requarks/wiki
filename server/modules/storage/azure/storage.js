const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob')
const pageHelper = require('../../../helpers/page.js')

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
  }
}
