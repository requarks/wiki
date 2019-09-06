const S3 = require('aws-sdk/clients/s3')

/* global WIKI */

/**
 * AWS S3 Client
 */
let s3 = null

/**
 * Get file extension based on content type
 */
const getFileExtension = contentType => {
  switch (contentType) {
    case 'markdown':
      return 'md'
    case 'html':
      return 'html'
    default:
      return 'txt'
  }
}

/**
 * Deduce the file path given the `page` object and the object's key to the page's path.
 */
const getFilePath = async (page, pathKey) => {
  const fileName = `${page[pathKey]}.${getFileExtension(page.contentType)}`
  const withLocaleCode = WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode
  return withLocaleCode ? `${page.localeCode}/${fileName}` : fileName
}

module.exports = {
  async activated() {
    // not used
  },
  async deactivated() {
    // not used
  },
  async init() {
    WIKI.logger.info('(STORAGE/S3) Initializing...')
    const { accessKeyId, accessSecret, region, bucket } = this.config
    s3 = new S3({
      accessKeyId,
      secretAccessKey: accessSecret,
      region,
      params: { Bucket: bucket },
      apiVersions: '2006-03-01'
    })
    // determine if a bucket exists and you have permission to access it
    await s3.headBucket().promise()
    WIKI.logger.info('(STORAGE/S3) Initialization completed.')
  },
  async created(page) {
    WIKI.logger.info(`(STORAGE/S3) Creating file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  },
  async updated(page) {
    WIKI.logger.info(`(STORAGE/S3) Updating file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  },
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/S3) Deleting file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await s3.deleteObject({ Key: filePath }).promise()
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/S3) Renaming file ${page.sourcePath} to ${page.destinationPath}...`)
    const sourceFilePath = await getFilePath(page, 'sourcePath')
    const destinationFilePath = await getFilePath(page, 'destinationPath')
    await s3.copyObject({ CopySource: sourceFilePath, Key: destinationFilePath }).promise()
    await s3.deleteObject({ Key: sourceFilePath }).promise()
  }
}
