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

  static async upload(opts) {
    const fileInfo = path.parse(opts.originalname)
    const fileHash = assetHelper.generateHash(`${opts.folder}/${opts.originalname}`)

    // Create asset entry
    const asset = await WIKI.models.assets.query().insert({
      filename: opts.originalname,
      hash: fileHash,
      ext: fileInfo.ext,
      kind: _.startsWith(opts.mimetype, 'image/') ? 'image' : 'binary',
      mime: opts.mimetype,
      fileSize: opts.size,
      authorId: opts.userId
    })

    // Save asset data
    try {
      const fileBuffer = await fs.readFile(opts.path)
      await WIKI.models.knex('assetData').insert({
        id: asset.id,
        data: fileBuffer
      })
    } catch (err) {
      WIKI.logger.warn(err)
    }

    // Move temp upload to cache
    await fs.move(opts.path, path.join(process.cwd(), `data/cache/${fileHash}.dat`))
  }

  static async getAsset(assetPath, res) {
    let asset = await WIKI.models.assets.getAssetFromCache(assetPath, res)
    if (!asset) {
      // asset = await WIKI.models.assets.getAssetFromDb(assetPath, res)
      // if (asset) {
      //   await WIKI.models.assets.saveAssetToCache(asset)
      // }
      res.sendStatus(404)
    }
  }

  static async getAssetFromCache(assetPath, res) {
    const fileHash = assetHelper.generateHash(assetPath)
    const cachePath = path.join(process.cwd(), `data/cache/${fileHash}.dat`)

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
}
