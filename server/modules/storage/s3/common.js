const S3 = require('aws-sdk/clients/s3')

/* global WIKI */

/**
 * Deduce the file path given the `page` object and the object's key to the page's path.
 */
const getFilePath = async (page, pathKey) => {
  const fileName = `${page[pathKey]}.${page.getFileExtension(page.contentType)}`
  const withLocaleCode = WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode
  return withLocaleCode ? `${page.localeCode}/${fileName}` : fileName
}

/**
 * Can be used with S3 compatible storage.
 */
module.exports = class S3CompatibleStorage {
  constructor(storageName) {
    this.storageName = storageName
  }
  async activated() {
    // not used
  }
  async deactivated() {
    // not used
  }
  async init() {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Initializing...`)
    const { accessKeyId, secretAccessKey, region, bucket, endpoint } = this.config
    this.s3 = new S3({
      accessKeyId,
      secretAccessKey,
      region,
      endpoint,
      params: { Bucket: bucket },
      apiVersions: '2006-03-01'
    })
    // determine if a bucket exists and you have permission to access it
    await this.s3.headBucket().promise()
    WIKI.logger.info(`(STORAGE/${this.storageName}) Initialization completed.`)
  }
  async created(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Creating file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await this.s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  }
  async updated(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Updating file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await this.s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  }
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Deleting file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await this.s3.deleteObject({ Key: filePath }).promise()
  }
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Renaming file ${page.sourcePath} to ${page.destinationPath}...`)
    const sourceFilePath = await getFilePath(page, 'sourcePath')
    const destinationFilePath = await getFilePath(page, 'destinationPath')
    await this.s3.copyObject({ CopySource: sourceFilePath, Key: destinationFilePath }).promise()
    await this.s3.deleteObject({ Key: sourceFilePath }).promise()
  }
}
