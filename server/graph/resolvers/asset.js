const _ = require('lodash')
const sanitize = require('sanitize-filename')
const graphHelper = require('../../helpers/graph')
const path = require('node:path')
const fs = require('fs-extra')
const { v4: uuid } = require('uuid')

module.exports = {
  Query: {
    async assetById(obj, args, context) {
      return null
    }
  },
  Mutation: {
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
          const fileHash = '' // assetHelper.generateHash(assetTargetPath)
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
        // -> Get Folder
        const folder = await WIKI.db.tree.query().findById(args.folderId)
        if (!folder) {
          throw new Error('ERR_INVALID_FOLDER_ID')
        }

        // -> Get Site
        const site = await WIKI.db.sites.query().findById(folder.siteId)
        if (!site) {
          throw new Error('ERR_INVALID_SITE_ID')
        }

        const results = await Promise.allSettled(args.files.map(async fl => {
          const { filename, mimetype, createReadStream } = await fl
          WIKI.logger.debug(`Processing asset upload ${filename} of type ${mimetype}...`)

          // Format filename
          const formattedFilename = ''

          // Save asset to DB
          const asset = await WIKI.db.knex('assets').insert({

          }).returning('id')

          // Add to tree
          await WIKI.db.knex('tree').insert({
            id: asset.id,
            folderPath: folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName,
            fileName: formattedFilename,
            type: 'asset',
            localeCode: ''
          })

          // Create thumbnail
          if (!['.png', '.jpg', 'webp', '.gif'].some(s => filename.endsWith(s))) {
            if (!WIKI.extensions.ext.sharp.isInstalled) {
              WIKI.logger.warn('Cannot generate asset thumbnail because the Sharp extension is not installed.')
            } else {
              const destFormat = mimetype.startsWith('image/svg') ? 'svg' : 'png'
              const destFolder = path.resolve(
                process.cwd(),
                WIKI.config.dataPath,
                `assets`
              )
              const destPath = path.join(destFolder, `asset-${site.id}-${hash}.${destFormat}`)
              await fs.ensureDir(destFolder)
              // -> Resize
              await WIKI.extensions.ext.sharp.resize({
                format: destFormat,
                inputStream: createReadStream(),
                outputPath: destPath,
                height: 72
              })
            }
          }

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
}
