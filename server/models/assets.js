/* global WIKI */

const Model = require('objection').Model
const moment = require('moment')
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const assetHelper = require('../helpers/asset')

/**
 * Users model
 */
module.exports = class Asset extends Model {
  static get tableName() { return 'assets' }

  static get jsonSchema () {
    return {
      type: 'object',

      properties: {
        id: {type: 'integer'},
        filename: {type: 'string'},
        hash: {type: 'string'},
        ext: {type: 'string'},
        kind: {type: 'string'},
        mime: {type: 'string'},
        fileSize: {type: 'integer'},
        metadata: {type: 'object'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
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
      hierarchy = await WIKI.models.assetFolders.getHierarchy(this.folderId)
    }
    return (this.folderId) ? hierarchy.map(h => h.slug).join('/') + `/${this.filename}` : this.filename
  }

  async deleteAssetCache() {
    await fs.remove(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${this.hash}.dat`))
  }

  static async upload(opts) {
    const fileInfo = path.parse(opts.originalname)
    const fileHash = assetHelper.generateHash(opts.assetPath)

    // Check for existing asset
    let asset = await WIKI.models.assets.query().where({
      hash: fileHash,
      folderId: opts.folderId
    }).first()

    // Build Object
    let assetRow = {
      filename: opts.originalname,
      hash: fileHash,
      ext: fileInfo.ext,
      kind: _.startsWith(opts.mimetype, 'image/') ? 'image' : 'binary',
      mime: opts.mimetype,
      fileSize: opts.size,
      folderId: opts.folderId
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

  static async getAsset(assetPath, res) {
    let assetExists = await WIKI.models.assets.getAssetFromCache(assetPath, res)
    if (!assetExists) {
      await WIKI.models.assets.getAssetFromDb(assetPath, res)
    }
  }

  static async getAssetFromCache(assetPath, res) {
    const fileHash = assetHelper.generateHash(assetPath)
    const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${fileHash}.dat`)

    return new Promise((resolve, reject) => {
      res.type(path.extname(assetPath))
      res.sendFile(cachePath, { dotfiles: 'deny' }, err => {
        if (err) {
          resolve(false)
        } else {
          resolve(true)
        }
      })
    })
  }

  static async getAssetFromDb(assetPath, res) {
    const fileHash = assetHelper.generateHash(assetPath)
    const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${fileHash}.dat`)

    const asset = await WIKI.models.assets.query().where('hash', fileHash).first()
    if (asset) {
      const assetData = await WIKI.models.knex('assetData').where('id', asset.id).first()
      res.type(asset.ext)
      res.send(assetData.data)
      await fs.outputFile(cachePath, assetData.data)
    } else {
      res.sendStatus(404)
    }
  }

  static async flushTempUploads() {
    return fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `uploads`))
  }
}
