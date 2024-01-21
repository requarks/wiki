import _ from 'lodash-es'
import sanitize from 'sanitize-filename'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import { decodeFolderPath, decodeTreePath, generateHash } from '../../helpers/common.mjs'
import path from 'node:path'
import fs from 'fs-extra'
import { v4 as uuid } from 'uuid'
import { pipeline } from 'node:stream/promises'

export default {
  Query: {
    async assetById(obj, args, context) {
      const asset = await WIKI.db.assets.query().findById(args.id)
      if (asset) {
        return asset
      } else {
        throw new Error('ERR_ASSET_NOT_FOUND')
      }
    }
  },
  Mutation: {
    /**
     * Rename an Asset
     */
    async renameAsset(obj, args, context) {
      try {
        const filename = sanitize(args.fileName).toLowerCase()

        const asset = await WIKI.db.assets.query().findById(args.id)
        const treeItem = await WIKI.db.tree.query().findById(args.id)
        if (asset && treeItem) {
          // Check for extension mismatch
          if (!_.endsWith(filename, asset.fileExt)) {
            throw new Error('ERR_ASSET_EXT_MISMATCH')
          }

          // Check for non-dot files changing to dotfile
          if (asset.fileExt.length > 0 && filename.length - asset.fileExt.length < 1) {
            throw new Error('ERR_ASSET_INVALID_DOTFILE')
          }

          // Check for collision
          const assetCollision = await WIKI.db.tree.query().where({
            folderPath: treeItem.folderPath,
            fileName: filename
          }).first()
          if (assetCollision) {
            throw new Error('ERR_ASSET_ALREADY_EXISTS')
          }

          // Check source asset permissions
          const assetSourcePath = (treeItem.folderPath) ? decodeTreePath(decodeFolderPath(treeItem.folderPath)) + `/${treeItem.fileName}` : treeItem.fileName
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetSourcePath })) {
            throw new Error('ERR_FORBIDDEN')
          }

          // Check target asset permissions
          const assetTargetPath = (treeItem.folderPath) ? decodeTreePath(decodeFolderPath(treeItem.folderPath)) + `/${filename}` : filename
          if (!WIKI.auth.checkAccess(context.req.user, ['write:assets'], { path: assetTargetPath })) {
            throw new Error('ERR_TARGET_FORBIDDEN')
          }

          // Update filename + hash
          const itemHash = generateHash(assetTargetPath)
          await WIKI.db.assets.query().patch({
            fileName: filename
          }).findById(asset.id)

          await WIKI.db.tree.query().patch({
            fileName: filename,
            title: filename,
            hash: itemHash
          }).findById(treeItem.id)

          // TODO: Delete old asset cache
          WIKI.events.outbound.emit('purgeItemCache', itemHash)

          // TODO: Rename in Storage
          // await WIKI.db.storage.assetEvent({
          //   event: 'renamed',
          //   asset: {
          //     ...asset,
          //     path: assetSourcePath,
          //     destinationPath: assetTargetPath,
          //     moveAuthorId: context.req.user.id,
          //     moveAuthorName: context.req.user.name,
          //     moveAuthorEmail: context.req.user.email
          //   }
          // })

          return {
            operation: generateSuccess('Asset has been renamed successfully.')
          }
        } else {
          throw new Error('ERR_INVALID_ASSET')
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
        const treeItem = await WIKI.db.tree.query().findById(args.id)
        if (treeItem) {
          // Check permissions
          const assetPath = (treeItem.folderPath) ? decodeTreePath(decodeFolderPath(treeItem.folderPath)) + `/${treeItem.fileName}` : treeItem.fileName
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetPath })) {
            throw new Error('ERR_FORBIDDEN')
          }

          // Delete from DB
          await WIKI.db.assets.query().deleteById(treeItem.id)
          await WIKI.db.tree.query().deleteById(treeItem.id)

          // TODO: Delete asset cache
          WIKI.events.outbound.emit('purgeItemCache', treeItem.hash)

          // TODO: Delete from Storage
          // await WIKI.db.storage.assetEvent({
          //   event: 'deleted',
          //   asset: {
          //     ...asset,
          //     path: assetPath,
          //     authorId: context.req.user.id,
          //     authorName: context.req.user.name,
          //     authorEmail: context.req.user.email
          //   }
          // })

          return {
            operation: generateSuccess('Asset has been deleted successfully.')
          }
        } else {
          throw new Error('ERR_INVALID_ASSET')
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
            locale: args.locale,
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
            locale: folder.locale,
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
          operation: generateSuccess('Temporary Uploads have been flushed successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
