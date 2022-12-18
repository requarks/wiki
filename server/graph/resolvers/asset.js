const _ = require('lodash')
const sanitize = require('sanitize-filename')
const graphHelper = require('../../helpers/graph')
const assetHelper = require('../../helpers/asset')
const path = require('node:path')
const fs = require('fs-extra')
const { v4: uuid } = require('uuid')

module.exports = {
  Query: {
    async assets(obj, args, context) {
      let cond = {
        folderId: args.folderId === 0 ? null : args.folderId
      }
      if (args.kind !== 'ALL') {
        cond.kind = args.kind.toLowerCase()
      }
      const folderHierarchy = await WIKI.db.assetFolders.getHierarchy(args.folderId)
      const folderPath = folderHierarchy.map(h => h.slug).join('/')
      const results = await WIKI.db.assets.query().where(cond)
      return _.filter(results, r => {
        const path = folderPath ? `${folderPath}/${r.filename}` : r.filename
        return WIKI.auth.checkAccess(context.req.user, ['read:assets'], { path })
      }).map(a => ({
        ...a,
        kind: a.kind.toUpperCase()
      }))
    },
    async assetsFolders(obj, args, context) {
      const results = await WIKI.db.assetFolders.query().where({
        parentId: args.parentFolderId === 0 ? null : args.parentFolderId
      })
      const parentHierarchy = await WIKI.db.assetFolders.getHierarchy(args.parentFolderId)
      const parentPath = parentHierarchy.map(h => h.slug).join('/')
      return _.filter(results, r => {
        const path = parentPath ? `${parentPath}/${r.slug}` : r.slug
        return WIKI.auth.checkAccess(context.req.user, ['read:assets'], { path })
      })
    }
  },
  Mutation: {
    /**
     * Create New Asset Folder
     */
    async createAssetsFolder(obj, args, context) {
      try {
        const folderSlug = sanitize(args.slug).toLowerCase()
        const parentFolderId = args.parentFolderId === 0 ? null : args.parentFolderId
        const result = await WIKI.db.assetFolders.query().where({
          parentId: parentFolderId,
          slug: folderSlug
        }).first()
        if (!result) {
          await WIKI.db.assetFolders.query().insert({
            slug: folderSlug,
            name: folderSlug,
            parentId: parentFolderId
          })
          return {
            responseResult: graphHelper.generateSuccess('Asset Folder has been created successfully.')
          }
        } else {
          throw new WIKI.Error.AssetFolderExists()
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Rename an Asset
     */
    async renameAsset(obj, args, context) {
      try {
        const filename = sanitize(args.filename).toLowerCase()

        const asset = await WIKI.db.assets.query().findById(args.id)
        if (asset) {
          // Check for extension mismatch
          if (!_.endsWith(filename, asset.ext)) {
            throw new WIKI.Error.AssetRenameInvalidExt()
          }

          // Check for non-dot files changing to dotfile
          if (asset.ext.length > 0 && filename.length - asset.ext.length < 1) {
            throw new WIKI.Error.AssetRenameInvalid()
          }

          // Check for collision
          const assetCollision = await WIKI.db.assets.query().where({
            filename,
            folderId: asset.folderId
          }).first()
          if (assetCollision) {
            throw new WIKI.Error.AssetRenameCollision()
          }

          // Get asset folder path
          let hierarchy = []
          if (asset.folderId) {
            hierarchy = await WIKI.db.assetFolders.getHierarchy(asset.folderId)
          }

          // Check source asset permissions
          const assetSourcePath = (asset.folderId) ? hierarchy.map(h => h.slug).join('/') + `/${asset.filename}` : asset.filename
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetSourcePath })) {
            throw new WIKI.Error.AssetRenameForbidden()
          }

          // Check target asset permissions
          const assetTargetPath = (asset.folderId) ? hierarchy.map(h => h.slug).join('/') + `/${filename}` : filename
          if (!WIKI.auth.checkAccess(context.req.user, ['write:assets'], { path: assetTargetPath })) {
            throw new WIKI.Error.AssetRenameTargetForbidden()
          }

          // Update filename + hash
          const fileHash = assetHelper.generateHash(assetTargetPath)
          await WIKI.db.assets.query().patch({
            filename: filename,
            hash: fileHash
          }).findById(args.id)

          // Delete old asset cache
          await asset.deleteAssetCache()

          // Rename in Storage
          await WIKI.db.storage.assetEvent({
            event: 'renamed',
            asset: {
              ...asset,
              path: assetSourcePath,
              destinationPath: assetTargetPath,
              moveAuthorId: context.req.user.id,
              moveAuthorName: context.req.user.name,
              moveAuthorEmail: context.req.user.email
            }
          })

          return {
            responseResult: graphHelper.generateSuccess('Asset has been renamed successfully.')
          }
        } else {
          throw new WIKI.Error.AssetInvalid()
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Delete an Asset
     */
    async deleteAsset(obj, args, context) {
      try {
        const asset = await WIKI.db.assets.query().findById(args.id)
        if (asset) {
          // Check permissions
          const assetPath = await asset.getAssetPath()
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetPath })) {
            throw new WIKI.Error.AssetDeleteForbidden()
          }

          await WIKI.db.knex('assetData').where('id', args.id).del()
          await WIKI.db.assets.query().deleteById(args.id)
          await asset.deleteAssetCache()

          // Delete from Storage
          await WIKI.db.storage.assetEvent({
            event: 'deleted',
            asset: {
              ...asset,
              path: assetPath,
              authorId: context.req.user.id,
              authorName: context.req.user.name,
              authorEmail: context.req.user.email
            }
          })

          return {
            responseResult: graphHelper.generateSuccess('Asset has been deleted successfully.')
          }
        } else {
          throw new WIKI.Error.AssetInvalid()
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Upload Assets
     */
    async uploadAssets(obj, args, context) {
      try {
        const results = await Promise.allSettled(args.files.map(async fl => {
          const { filename, mimetype, createReadStream } = await fl
          WIKI.logger.debug(`Processing asset upload ${filename} of type ${mimetype}...`)

          

          if (!WIKI.extensions.ext.sharp.isInstalled) {
            throw new Error('This feature requires the Sharp extension but it is not installed.')
          }
          if (!['.png', '.jpg', 'webp', '.gif'].some(s => filename.endsWith(s))) {
            throw new Error('Invalid File Extension. Must be svg, png, jpg, webp or gif.')
          }
          const destFormat = mimetype.startsWith('image/svg') ? 'svg' : 'png'
          const destFolder = path.resolve(
            process.cwd(),
            WIKI.config.dataPath,
            `assets`
          )
          const destPath = path.join(destFolder, `logo-${args.id}.${destFormat}`)
          await fs.ensureDir(destFolder)
          // -> Resize
          await WIKI.extensions.ext.sharp.resize({
            format: destFormat,
            inputStream: createReadStream(),
            outputPath: destPath,
            height: 72
          })
          // -> Save logo meta to DB
          const site = await WIKI.db.sites.query().findById(args.id)
          if (!site.config.assets.logo) {
            site.config.assets.logo = uuid()
          }
          site.config.assets.logoExt = destFormat
          await WIKI.db.sites.query().findById(args.id).patch({ config: site.config })
          await WIKI.db.sites.reloadCache()
          // -> Save image data to DB
          const imgBuffer = await fs.readFile(destPath)
          await WIKI.db.knex('assetData').insert({
            id: site.config.assets.logo,
            data: imgBuffer
          }).onConflict('id').merge()
        }))
        WIKI.logger.debug('Asset(s) uploaded successfully.')
        return {
          operation: graphHelper.generateSuccess('Asset(s) uploaded successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * Flush Temporary Uploads
     */
    async flushTempUploads(obj, args, context) {
      try {
        await WIKI.db.assets.flushTempUploads()
        return {
          responseResult: graphHelper.generateSuccess('Temporary Uploads have been flushed successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
  // File: {
  //   folder(fl) {
  //     return fl.getFolder()
  //   }
  // }
}
