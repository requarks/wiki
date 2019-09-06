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
    WIKI.logger.info('(STORAGE/DIGITALOCEAN) Initializing...')
    const { accessKeyId, secretAccessKey, region, spaceId } = this.config
    s3 = new S3({
      accessKeyId,
      secretAccessKey,
      endpoint: `${region}.digitaloceanspaces.com`,
      params: { Bucket: spaceId },
      apiVersions: '2006-03-01'
    })
    // determine if a space exists and you have permission to access it
    await s3.headBucket().promise()
    WIKI.logger.info('(STORAGE/DIGITALOCEAN) Initialization completed.')
  },
  async created(page) {
    WIKI.logger.info(`(STORAGE/DIGITALOCEAN) Creating file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  },
  async updated(page) {
    WIKI.logger.info(`(STORAGE/DIGITALOCEAN) Updating file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await s3.putObject({ Key: filePath, Body: page.injectMetadata() }).promise()
  },
  async deleted(page) {
    WIKI.logger.info(`(STORAGE/DIGITALOCEAN) Deleting file ${page.path}...`)
    const filePath = await getFilePath(page, 'path')
    await s3.deleteObject({ Key: filePath }).promise()
  },
  async renamed(page) {
    WIKI.logger.info(`(STORAGE/DIGITALOCEAN) Renaming file ${page.sourcePath} to ${page.destinationPath}...`)
    const sourceFilePath = await getFilePath(page, 'sourcePath')
    const destinationFilePath = await getFilePath(page, 'destinationPath')
    await s3.copyObject({ CopySource: sourceFilePath, Key: destinationFilePath }).promise()
    await s3.deleteObject({ Key: sourceFilePath }).promise()
  }
}
