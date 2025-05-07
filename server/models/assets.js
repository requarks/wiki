/* global WIKI */

const Model = require('objection').Model
const moment = require('moment')
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const assetHelper = require('../helpers/asset')
const Promise = require('bluebird')

const getSite = async (siteId) => {
  return WIKI.models.sites.getSiteById({ siteId, forceReload: true })
}

/**
 * Users model
 */
module.exports = class Asset extends Model {
  static get tableName() { return 'assets' }

  static get jsonSchema() {
    return {
      type: 'object',

      properties: {
        id: { type: 'integer' },
        filename: { type: 'string' },
        hash: { type: 'string' },
        ext: { type: 'string' },
        kind: { type: 'string' },
        mime: { type: 'string' },
        fileSize: { type: 'integer' },
        metadata: { type: 'object' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        siteId: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'assets.authorId',
          to: 'users.id'
        }
      },
      folder: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./assetFolders'),
        join: {
          from: 'assets.folderId',
          to: 'assetFolders.id'
        }
      },
      site: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./sites'),
        join: {
          from: 'assets.siteId',
          to: 'sites.id'
        }
      }
    }
  }

  async $beforeUpdate(opt, context) {
    await super.$beforeUpdate(opt, context)

    this.updatedAt = moment.utc().toISOString()
  }
  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = moment.utc().toISOString()
    this.updatedAt = moment.utc().toISOString()
  }

  async getAssetPath() {
    let hierarchy = []
    if (this.folderId) {
      hierarchy = await WIKI.models.assetFolders.getHierarchy(this.folderId, this.siteId)
    }
    return (this.folderId) ? hierarchy.map(h => h.slug).join('/') + `/${this.filename}` : this.filename
  }

  async deleteAssetCache() {
    await fs.remove(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${this.hash}.dat`))
  }

  static async upload(opts) {
    if (!opts.siteId) throw new Error('siteId is missing, cannot process')
    if (!opts.assetPath) throw new Error('assetPath is missing, cannot process')

    const site = await getSite(opts.siteId)
    if (!site.path) throw new Error(`Could not find site with ID: ${opts.siteId}`)
    WIKI.logger.debug(`Storing asset: ${site.path}/${opts.assetPath}`)

    const fileInfo = path.parse(opts.originalname)
    const fileHash = assetHelper.generateHash(`${site.path}/${opts.assetPath}`)

    // Check for existing asset
    let asset = await WIKI.models.assets.query().where({
      hash: fileHash,
      folderId: opts.folderId,
      siteId: opts.siteId
    }).first()

    // Build Object
    let assetRow = {
      filename: opts.originalname,
      hash: fileHash,
      ext: fileInfo.ext,
      kind: _.startsWith(opts.mimetype, 'image/') ? 'image' : 'binary',
      mime: opts.mimetype,
      fileSize: opts.size,
      folderId: opts.folderId,
      siteId: opts.siteId
    }

    // Sanitize SVG contents
    if (
      WIKI.config.uploads.scanSVG &&
      (
        opts.mimetype.toLowerCase().startsWith('image/svg') ||
        fileInfo.ext.toLowerCase() === '.svg'
      )
    ) {
      const svgSanitizeJob = await WIKI.scheduler.registerJob({
        name: 'sanitize-svg',
        immediate: true,
        worker: true
      }, opts.path)
      await svgSanitizeJob.finished
    }

    // Save asset data
    try {
      const fileBuffer = await fs.readFile(opts.path)

      if (asset) {
        // Patch existing asset
        if (opts.mode === 'upload') {
          assetRow.authorId = opts.user.id
        }
        await WIKI.models.assets.query().patch(assetRow).findById(asset.id)
        await WIKI.models.knex('assetData').where({
          id: asset.id
        }).update({
          data: fileBuffer
        })
      } else {
        // Create asset entry
        assetRow.authorId = opts.user.id
        asset = await WIKI.models.assets.query().insert(assetRow)
        await WIKI.models.knex('assetData').insert({
          id: asset.id,
          data: fileBuffer
        })
      }

      // Move temp upload to cache
      if (opts.mode === 'upload') {
        await fs.move(opts.path, path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${fileHash}.dat`), { overwrite: true })
      } else {
        await fs.copy(opts.path, path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${fileHash}.dat`), { overwrite: true })
      }

      // Add to Storage
      if (!opts.skipStorage) {
        await WIKI.models.storage.assetEvent({
          event: 'uploaded',
          asset: {
            ...asset,
            path: await asset.getAssetPath(),
            data: fileBuffer,
            authorId: opts.user.id,
            authorName: opts.user.name,
            authorEmail: opts.user.email
          }
        })
      }
    } catch (err) {
      WIKI.logger.warn(err)
    }
  }

  static async getAsset(sitePath, assetPath, res, returnBase64Asset = false) {
    try {
      WIKI.logger.debug(`Retrieving asset: ${sitePath}/${assetPath}`)
      const combinedPath = `${sitePath}/${assetPath}`
      const fileInfo = assetHelper.getPathInfo(combinedPath)
      const fileHash = assetHelper.generateHash(combinedPath)

      const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${fileHash}.dat`)

      // Force unsafe extensions to download
      if (WIKI.config.uploads.forceDownload && !assetHelper.isSafeExtension(fileInfo.ext) && !returnBase64Asset) {
        res.set('Content-disposition', 'attachment; filename=' + encodeURIComponent(fileInfo.base))
      }

      let base64AssetOrSendDirectlyFileInResponse = await WIKI.models.assets.getAssetFromCache(assetPath, cachePath, res, returnBase64Asset)

      if (base64AssetOrSendDirectlyFileInResponse) {
        WIKI.logger.debug(`Asset ${sitePath}/${assetPath} served from cache`)
        return base64AssetOrSendDirectlyFileInResponse
      }
      base64AssetOrSendDirectlyFileInResponse = await WIKI.models.assets.getAssetFromStorage(assetPath, res, returnBase64Asset)
      if (base64AssetOrSendDirectlyFileInResponse) {
        WIKI.logger.debug(`Asset ${sitePath}/${assetPath} served from storage`)
        return base64AssetOrSendDirectlyFileInResponse
      }
      WIKI.logger.debug(`Asset ${sitePath}/${assetPath} served from database (cache miss)`)
      return await WIKI.models.assets.getAssetFromDb(fileHash, cachePath, res, returnBase64Asset)
    } catch (err) {
      if (err.code === `ECONNABORTED` || err.code === `EPIPE`) {
        return
      }
      WIKI.logger.error(err)
      res.sendStatus(500)
    }
  }

  static async convertToBase64(filePath) {
    const data = await fs.readFile(filePath)
    return data.toString('base64')
  }

  static async getAssetFromCache(assetPath, cachePath, res, returnBase64Asset) {
    try {
      await fs.access(cachePath, fs.constants.R_OK)
    } catch (err) {
      return false
    }
    if (returnBase64Asset) {
      return this.convertToBase64(cachePath)
    }
    const sendFile = Promise.promisify(res.sendFile, { context: res })
    res.type(path.extname(assetPath))
    await sendFile(cachePath, { dotfiles: 'deny' })
    return true
  }

  static async getAssetFromStorage(assetPath, res, returnBase64Asset) {
    if (returnBase64Asset) {
      // NOT SUPPORTED
      return false
    }
    const localLocations = await WIKI.models.storage.getLocalLocations({
      asset: {
        path: assetPath
      }
    })
    for (let location of _.filter(localLocations, location => Boolean(location.path))) {
      const assetExists = await WIKI.models.assets.getAssetFromCache(assetPath, location.path, res)
      if (assetExists) {
        return true
      }
    }
    return false
  }

  static async getAssetFromDb(fileHash, cachePath, res, returnBase64Asset) {
    const asset = await WIKI.models.assets.query().where('hash', fileHash).first()

    if (asset) {
      const assetData = await WIKI.models.knex('assetData').where('id', asset.id).first()
      // Todo: refactor as its just a temporary solution
      if (!res) {
        return assetData.data.toString('base64')
      }
      res.type(asset.ext)
      res.send(assetData.data)
      await fs.outputFile(cachePath, assetData.data)
      if (returnBase64Asset) {
        return this.convertToBase64(cachePath)
      }
      return true
    } else {
      if (returnBase64Asset) {
        return false
      }
      if (!res) {
        return false
      }
      res.sendStatus(404)
    }
  }

  static async flushTempUploads() {
    return fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `uploads`))
  }
}
