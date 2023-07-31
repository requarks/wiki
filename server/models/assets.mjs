import { Model } from 'objection'
import path from 'node:path'
import fse from 'fs-extra'
import { startsWith } from 'lodash-es'
import { generateHash } from '../helpers/common.mjs'

import { User } from './users.mjs'

/**
 * Users model
 */
export class Asset extends Model {
  static get tableName() { return 'assets' }

  static get jsonSchema () {
    return {
      type: 'object',

      properties: {
        id: {type: 'string'},
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
        modelClass: User,
        join: {
          from: 'assets.authorId',
          to: 'users.id'
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
      hierarchy = await WIKI.db.assetFolders.getHierarchy(this.folderId)
    }
    return (this.folderId) ? hierarchy.map(h => h.slug).join('/') + `/${this.filename}` : this.filename
  }

  async deleteAssetCache() {
    await fse.remove(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${this.hash}.dat`))
  }

  static async upload(opts) {
    const fileInfo = path.parse(opts.originalname)

    // Check for existing asset
    let asset = await WIKI.db.assets.query().where({
      // hash: fileHash,
      folderId: opts.folderId
    }).first()

    // Build Object
    let assetRow = {
      filename: opts.originalname,
      ext: fileInfo.ext,
      kind: startsWith(opts.mimetype, 'image/') ? 'image' : 'binary',
      mime: opts.mimetype,
      fileSize: opts.size,
      folderId: opts.folderId
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
      const fileBuffer = await fse.readFile(opts.path)

      if (asset) {
        // Patch existing asset
        if (opts.mode === 'upload') {
          assetRow.authorId = opts.user.id
        }
        await WIKI.db.assets.query().patch(assetRow).findById(asset.id)
        await WIKI.db.knex('assetData').where({
          id: asset.id
        }).update({
          data: fileBuffer
        })
      } else {
        // Create asset entry
        assetRow.authorId = opts.user.id
        asset = await WIKI.db.assets.query().insert(assetRow)
        await WIKI.db.knex('assetData').insert({
          id: asset.id,
          data: fileBuffer
        })
      }

      // Move temp upload to cache
      // if (opts.mode === 'upload') {
      //   await fs.move(opts.path, path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${fileHash}.dat`), { overwrite: true })
      // } else {
      //   await fs.copy(opts.path, path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${fileHash}.dat`), { overwrite: true })
      // }

      // Add to Storage
      if (!opts.skipStorage) {
        await WIKI.db.storage.assetEvent({
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

  static async getThumbnail ({ id, path, locale, siteId }) {
    return WIKI.db.tree.query()
      .select('tree.*', 'assets.preview', 'assets.previewState')
      .innerJoin('assets', 'tree.id', 'assets.id')
      .where(id ? { 'tree.id': id } : {
        'tree.hash': generateHash(path),
        'tree.locale': locale,
        'tree.siteId': siteId
      })
      .first()
  }

  static async getAsset({ pathArgs, siteId }, res) {
    try {
      const fileInfo = path.parse(pathArgs.path.toLowerCase())
      const fileHash = generateHash(pathArgs.path)
      const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${siteId}/${fileHash}.dat`)

      // Force unsafe extensions to download
      if (WIKI.config.security.forceAssetDownload && !['.png', '.apng', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(fileInfo.ext)) {
        res.set('Content-disposition', 'attachment; filename=' + encodeURIComponent(fileInfo.base))
      }

      if (await WIKI.db.assets.getAssetFromCache({ cachePath, extName: fileInfo.ext }, res)) {
        return
      }
      // if (await WIKI.db.assets.getAssetFromStorage(assetPath, res)) {
      //   return
      // }
      await WIKI.db.assets.getAssetFromDb({ pathArgs, fileHash, cachePath, siteId }, res)
    } catch (err) {
      if (err.code === `ECONNABORTED` || err.code === `EPIPE`) {
        return
      }
      WIKI.logger.error(err)
      res.sendStatus(500)
    }
  }

  static async getAssetFromCache({ cachePath, extName }, res) {
    try {
      await fse.access(cachePath, fse.constants.R_OK)
    } catch (err) {
      return false
    }
    res.type(extName)
    await new Promise(resolve => res.sendFile(cachePath, { dotfiles: 'deny' }, resolve))
    return true
  }

  static async getAssetFromStorage(assetPath, res) {
    const localLocations = await WIKI.db.storage.getLocalLocations({
      asset: {
        path: assetPath
      }
    })
    for (let location of localLocations.filter(location => Boolean(location.path))) {
      const assetExists = await WIKI.db.assets.getAssetFromCache(assetPath, location.path, res)
      if (assetExists) {
        return true
      }
    }
    return false
  }

  static async getAssetFromDb({ pathArgs, fileHash, cachePath, siteId }, res) {
    const asset = await WIKI.db.knex('tree').where({
      siteId,
      hash: fileHash
    }).first()
    if (asset) {
      const assetData = await WIKI.db.knex('assets').where('id', asset.id).first()
      res.type(assetData.fileExt)
      res.send(assetData.data)
      await fse.outputFile(cachePath, assetData.data)
    } else {
      res.sendStatus(404)
    }
  }

  static async flushTempUploads() {
    return fse.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `uploads`))
  }
}
