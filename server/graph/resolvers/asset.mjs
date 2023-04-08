import _ from 'lodash-es'
import sanitize from 'sanitize-filename'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import path from 'node:path'
import fs from 'fs-extra'
import { v4 as uuid } from 'uuid'
import { pipeline } from 'node:stream/promises'

export default {
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
            responseResult: generateSuccess('Asset has been renamed successfully.')
          }
        } else {
          throw new WIKI.Error.AssetInvalid()
        }
      } catch (err) {
        return generateError(err)
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
            responseResult: generateSuccess('Asset has been deleted successfully.')
          }
        } else {
          throw new WIKI.Error.AssetInvalid()
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Upload Assets
     */
    async uploadAssets(obj, args, context) {
      try {
        // -> Get Folder
        let folder = {}
        if (args.folderId || args.folderPath) {
          // Get Folder by ID
          folder = await WIKI.db.tree.getFolder({ id: args.folderId })
          if (!folder) {
            throw new Error('ERR_INVALID_FOLDER_ID')
          }
        } else if (args.folderPath) {
          // Get Folder by Path
          if (!args.locale) {
            throw new Error('ERR_MISSING_LOCALE')
          } else if (!args.siteId) {
            throw new Error('ERR_MISSING_SITE_ID')
          }
          folder = await WIKI.db.tree.getFolder({
            path: args.folderPath,
            locale: args.locale,
            siteId: args.siteId,
            createIfMissing: true
          })
          if (!folder) {
            throw new Error('ERR_INVALID_FOLDER_PATH')
          }
        } else {
          // Use Root Folder
          if (!args.locale) {
            throw new Error('ERR_MISSING_LOCALE')
          } else if (!args.siteId) {
            throw new Error('ERR_MISSING_SITE_ID')
          }
          folder = {
            folderPath: '',
            fileName: '',
            localeCode: args.locale,
            siteId: args.siteId
          }
        }

        // -> Get Site
        const site = await WIKI.db.sites.query().findById(folder.siteId)
        if (!site) {
          throw new Error('ERR_INVALID_SITE_ID')
        }

        // -> Get Storage Targets
        const storageTargets = await WIKI.db.storage.getTargets({ siteId: folder.siteId, enabledOnly: true })

        // -> Process Assets
        const results = await Promise.allSettled(args.files.map(async fl => {
          const { filename, mimetype, createReadStream } = await fl
          const sanitizedFilename = sanitize(filename).toLowerCase().trim()

          WIKI.logger.debug(`Processing asset upload ${sanitizedFilename} of type ${mimetype}...`)

          // Parse file extension
          if (sanitizedFilename.indexOf('.') <= 0) {
            throw new Error('ERR_ASSET_DOTFILE_NOTALLOWED')
          }
          const fileExt = _.last(sanitizedFilename.split('.')).toLowerCase()

          // Determine asset kind
          let fileKind = 'other'
          switch (fileExt) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'webp':
            case 'gif':
            case 'tiff':
            case 'svg':
              fileKind = 'image'
              break
            case 'pdf':
            case 'docx':
            case 'xlsx':
            case 'pptx':
            case 'odt':
            case 'epub':
            case 'csv':
            case 'md':
            case 'txt':
            case 'adoc':
            case 'rtf':
            case 'wdp':
            case 'xps':
            case 'ods':
              fileKind = 'document'
              break
          }

          // Save to temp disk
          const tempFileId = uuid()
          const tempFilePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `uploads/${tempFileId}.dat`)
          WIKI.logger.debug(`Writing asset upload ${sanitizedFilename} to temp disk...`)
          await pipeline(
            createReadStream(),
            fs.createWriteStream(tempFilePath)
          )
          WIKI.logger.debug(`Querying asset ${sanitizedFilename} file size...`)
          const tempFileStat = await fs.stat(tempFilePath)

          // Format filename
          const formattedFilename = site.config.uploads.normalizeFilename ? sanitizedFilename.replaceAll(' ', '-') : sanitizedFilename

          // Save asset to DB
          WIKI.logger.debug(`Saving asset ${sanitizedFilename} metadata to DB...`)
          const assetRaw = await WIKI.db.knex('assets').insert({
            fileName: formattedFilename,
            fileExt,
            kind: fileKind,
            mimeType: mimetype,
            fileSize: Math.round(tempFileStat.size),
            meta: {},
            previewState: fileKind === 'image' ? 'pending' : 'none',
            authorId: context.req.user.id,
            siteId: folder.siteId
          }).returning('*')

          const asset = assetRaw[0]

          // Add to tree
          await WIKI.db.tree.addAsset({
            id: asset.id,
            parentPath: folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName,
            fileName: formattedFilename,
            title: formattedFilename,
            locale: folder.localeCode,
            siteId: folder.siteId,
            meta: {
              authorId: asset.authorId,
              creatorId: asset.creatorId,
              fileSize: asset.fileSize,
              fileExt,
              mimeType: mimetype,
              ownerId: asset.ownerId
            }
          })

          // Save to storage targets
          const storageInfo = {}
          const failedStorage = []
          await Promise.allSettled(storageTargets.map(async storageTarget => {
            WIKI.logger.debug(`Saving asset ${sanitizedFilename} to storage target ${storageTarget.module} (${storageTarget.id})...`)
            try {
              const strInfo = await WIKI.storage.modules[storageTarget.module].assetUploaded({
                asset,
                createReadStream,
                storageTarget,
                tempFilePath
              })
              storageInfo[storageTarget.id] = strInfo ?? true
            } catch (err) {
              WIKI.logger.warn(`Failed to save asset ${sanitizedFilename} to storage target ${storageTarget.module} (${storageTarget.id}):`)
              WIKI.logger.warn(err)
              failedStorage.push({
                storageId: storageTarget.id,
                storageModule: storageTarget.module,
                fileId: asset.id,
                fileName: formattedFilename
              })
            }
          }))

          // Save Storage Info to DB
          await WIKI.db.knex('assets').where({ id: asset.id }).update({ storageInfo })

          // Create thumbnail
          if (fileKind === 'image') {
            if (!WIKI.extensions.ext.sharp.isInstalled) {
              WIKI.logger.warn('Cannot generate asset thumbnail because the Sharp extension is not installed.')
            } else {
              WIKI.logger.debug(`Generating thumbnail of asset ${sanitizedFilename}...`)
              const previewDestPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `uploads/${tempFileId}-thumb.webp`)
              // -> Resize
              await WIKI.extensions.ext.sharp.resize({
                format: 'webp',
                inputStream: createReadStream(),
                outputPath: previewDestPath,
                width: 320,
                height: 200,
                fit: 'inside'
              })
              // -> Save to DB
              await WIKI.db.knex('assets').where({
                id: asset.id
              }).update({
                preview: await fs.readFile(previewDestPath),
                previewState: 'ready'
              })

              // -> Delete
              await fs.remove(previewDestPath)
            }
          }

          WIKI.logger.debug(`Removing asset ${sanitizedFilename} temp file...`)
          await fs.remove(tempFilePath)

          WIKI.logger.debug(`Processed asset ${sanitizedFilename} successfully.`)
          return failedStorage
        }))

        // Return results
        const failedResults = results.filter(r => r.status === 'rejected')
        if (failedResults.length > 0) {
          // -> One or more thrown errors
          WIKI.logger.warn(`Failed to upload one or more assets:`)
          for (const failedResult of failedResults) {
            WIKI.logger.warn(failedResult.reason)
          }
          throw new Error('ERR_UPLOAD_FAILED')
        } else {
          const failedSaveTargets = results.map(r => r.value).filter(r => r.length > 0)
          if (failedSaveTargets.length > 0) {
            // -> One or more storage target save errors
            WIKI.logger.warn('Failed to save one or more assets to storage targets.')
            throw new Error('ERR_UPLOAD_TARGET_FAILED')
          } else {
            WIKI.logger.debug('Asset(s) uploaded successfully.')
            return {
              operation: generateSuccess('Asset(s) uploaded successfully')
            }
          }
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    },
    /**
     * Flush Temporary Uploads
     */
    async flushTempUploads(obj, args, context) {
      try {
        await WIKI.db.assets.flushTempUploads()
        return {
          responseResult: generateSuccess('Temporary Uploads have been flushed successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
