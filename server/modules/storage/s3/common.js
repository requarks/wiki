const S3 = require('aws-sdk/clients/s3')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const _ = require('lodash')
const pageHelper = require('../../../helpers/page.js')

/* global WIKI */

/**
 * Deduce the file path given the `page` object and the object's key to the page's path.
 */
const getFilePath = (page, pathKey) => {
  const fileName = `${page[pathKey]}.${pageHelper.getFileExtension(page.contentType)}`
  const withLocaleCode = WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode
  return withLocaleCode ? `${page.localeCode}/${fileName}` : fileName
}

/**
 * Can be used with S3 compatible storage.
 */
module.exports = class S3CompatibleStorage {
  constructor(storageName) {
    this.storageName = storageName
    this.bucketName = ""
  }
  async activated() {
    // not used
  }
  async deactivated() {
    // not used
  }
  async init() {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Initializing...`)
    const { accessKeyId, secretAccessKey, bucket } = this.config
    const s3Config = {
      accessKeyId,
      secretAccessKey,
      params: { Bucket: bucket },
      apiVersions: '2006-03-01'
    }

    if (!_.isNil(this.config.region)) {
      s3Config.region = this.config.region
    }
    if (!_.isNil(this.config.endpoint)) {
      s3Config.endpoint = this.config.endpoint
    }
    if (!_.isNil(this.config.sslEnabled)) {
      s3Config.sslEnabled = this.config.sslEnabled
    }
    if (!_.isNil(this.config.s3ForcePathStyle)) {
      s3Config.s3ForcePathStyle = this.config.s3ForcePathStyle
    }
    if (!_.isNil(this.config.s3BucketEndpoint)) {
      s3Config.s3BucketEndpoint = this.config.s3BucketEndpoint
    }

    this.s3 = new S3(s3Config)
    this.bucketName = bucket

    // determine if a bucket exists and you have permission to access it
    await this.s3.headBucket().promise()

    WIKI.logger.info(`(STORAGE/${this.storageName}) Initialization completed.`)
  }
  async created(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Creating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  }
  async updated(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Updating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  }
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Deleting file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.s3.deleteObject({ Key: filePath }).promise()
  }
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
    await this.s3.copyObject({ CopySource: `${this.bucketName}/${sourceFilePath}`, Key: destinationFilePath }).promise()
    await this.s3.deleteObject({ Key: sourceFilePath }).promise()
  }
  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Creating new file ${asset.path}...`)
    await this.s3.putObject({ Key: asset.path, Body: asset.data }).promise()
  }
  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to delete
   */
  async assetDeleted (asset) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Deleting file ${asset.path}...`)
    await this.s3.deleteObject({ Key: asset.path }).promise()
  }
  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to rename
   */
  async assetRenamed (asset) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Renaming file from ${asset.path} to ${asset.destinationPath}...`)
    await this.s3.copyObject({ CopySource: `${this.bucketName}/${asset.path}`, Key: asset.destinationPath }).promise()
    await this.s3.deleteObject({ Key: asset.path }).promise()
  }
  async getLocalLocation () {

  }
  /**
   * HANDLERS
   */
  async exportAll() {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Exporting all content to the cloud provider...`)

    // -> Pages
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt', 'createdAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new stream.Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          const filePath = getFilePath(page, 'path')
          WIKI.logger.info(`(STORAGE/${this.storageName}) Adding page ${filePath}...`)
          await this.s3.putObject({ Key: filePath, Body: pageHelper.injectPageMetadata(page) }).promise()
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
          WIKI.logger.info(`(STORAGE/${this.storageName}) Adding asset ${filename}...`)
          await this.s3.putObject({ Key: filename, Body: asset.data }).promise()
          cb()
        }
      })
    )

    WIKI.logger.info(`(STORAGE/${this.storageName}) All content has been pushed to the cloud provider.`)
  }
}
