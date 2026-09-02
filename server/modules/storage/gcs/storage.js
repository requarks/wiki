/**
 * Google Cloud Storage module for Wiki.js
 *
 * Author: Horus Gonzalez
 * Built with help from Claude (Anthropic)
 *
 * Fills a gap in Wiki.js core, which does not ship a GCS storage target
 * out of the box (only S3, Azure, Dropbox, Box, GDrive, OneDrive,
 * DigitalOcean Spaces, SFTP, Git, and local disk).
 */
const { Storage } = require('@google-cloud/storage')
const { pipeline } = require('node:stream/promises')
const { Transform } = require('node:stream')
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
    WIKI.logger.info(`(STORAGE/GCS) Initializing...`)
    const { bucket, projectId, serviceAccountKey } = this.config

    let credentials
    try {
      credentials = JSON.parse(serviceAccountKey)
    } catch (err) {
      throw new Error('Invalid Service Account Key: must be valid JSON.')
    }

    this.client = new Storage({
      projectId: projectId || credentials.project_id,
      credentials
    })
    this.bucket = this.client.bucket(bucket)

    const [exists] = await this.bucket.exists()
    if (!exists) {
      throw new Error(`Bucket ${bucket} does not exist or is not accessible with the provided credentials.`)
    }

    WIKI.logger.info(`(STORAGE/GCS) Initialization completed.`)
  },
  async created (page) {
    WIKI.logger.info(`(STORAGE/GCS) Creating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    const pageContent = page.injectMetadata()
    await this.saveContent(filePath, pageContent)
  },
  async updated (page) {
    WIKI.logger.info(`(STORAGE/GCS) Updating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    const pageContent = page.injectMetadata()
    await this.saveContent(filePath, pageContent)
  },
  async deleted (page) {
    WIKI.logger.info(`(STORAGE/GCS) Deleting file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.bucket.file(filePath).delete({ ignoreNotFound: true })
  },
  async renamed (page) {
    WIKI.logger.info(`(STORAGE/GCS) Renaming file ${page.path} to ${page.destinationPath}...`)
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
    await this.bucket.file(sourceFilePath).move(destinationFilePath)
  },
  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    WIKI.logger.info(`(STORAGE/GCS) Creating new file ${asset.path}...`)
    await this.saveContent(asset.path, asset.data)
  },
  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to delete
   */
  async assetDeleted (asset) {
    WIKI.logger.info(`(STORAGE/GCS) Deleting file ${asset.path}...`)
    await this.bucket.file(asset.path).delete({ ignoreNotFound: true })
  },
  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to rename
   */
  async assetRenamed (asset) {
    WIKI.logger.info(`(STORAGE/GCS) Renaming file from ${asset.path} to ${asset.destinationPath}...`)
    await this.bucket.file(asset.path).move(asset.destinationPath)
  },
  async getLocalLocation () {

  },
  /**
   * Save content to the bucket and apply public ACL if configured.
   *
   * @param {String} filePath Destination path within the bucket
   * @param {String|Buffer} content File content
   */
  async saveContent (filePath, content) {
    const file = this.bucket.file(filePath)
    await file.save(content, { resumable: false })
    if (this.config.publicRead) {
      try {
        await file.makePublic()
      } catch (err) {
        WIKI.logger.warn(`(STORAGE/GCS) Could not set public ACL on ${filePath}: ${err.message}`)
      }
    }
  },
  /**
   * HANDLERS
   */
  async exportAll () {
    WIKI.logger.info(`(STORAGE/GCS) Exporting all content to Google Cloud Storage...`)

    // -> Pages
    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt', 'createdAt').select().from('pages').where({
        isPrivate: false
      }).stream(),
      new Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          const filePath = getFilePath(page, 'path')
          WIKI.logger.info(`(STORAGE/GCS) Adding page ${filePath}...`)
          const pageContent = pageHelper.injectPageMetadata(page)
          await this.saveContent(filePath, pageContent)
          cb()
        }
      })
    )

    // -> Assets
    const assetFolders = await WIKI.models.assetFolders.getAllPaths()

    await pipeline(
      WIKI.models.knex.column('filename', 'folderId', 'data').select().from('assets').join('assetData', 'assets.id', '=', 'assetData.id').stream(),
      new Transform({
        objectMode: true,
        transform: async (asset, enc, cb) => {
          const filename = (asset.folderId && asset.folderId > 0) ? `${_.get(assetFolders, asset.folderId)}/${asset.filename}` : asset.filename
          WIKI.logger.info(`(STORAGE/GCS) Adding asset ${filename}...`)
          await this.saveContent(filename, asset.data)
          cb()
        }
      })
    )

    WIKI.logger.info('(STORAGE/GCS) All content has been pushed to Google Cloud Storage.')
  }
}
