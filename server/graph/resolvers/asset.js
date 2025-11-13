const _ = require('lodash')
const sanitize = require('sanitize-filename')
const fs = require('fs-extra')
const path = require('path')
const mime = require('mime-types')
const fetch = require('node-fetch')
const { URL } = require('url')
const FileType = require('file-type')
const graphHelper = require('../../helpers/graph')
const assetHelper = require('../../helpers/asset')

/* global WIKI */

const REMOTE_FETCH_TIMEOUT = 15000
const REMOTE_ALLOWED_MIME_PREFIXES = ['image/', 'video/']

module.exports = {
  Query: {
    async assets() { return {} }
  },
  Mutation: {
    async assets() { return {} }
  },
  AssetQuery: {
    async list(obj, args, context) {
      let cond = {
        folderId: args.folderId === 0 ? null : args.folderId
      }
      if (args.kind !== 'ALL') {
        cond.kind = args.kind.toLowerCase()
      }
      const folderHierarchy = await WIKI.models.assetFolders.getHierarchy(args.folderId)
      const folderPath = folderHierarchy.map(h => h.slug).join('/')
      const results = await WIKI.models.assets.query().where(cond)
      return _.filter(results, r => {
        const path = folderPath ? `${folderPath}/${r.filename}` : r.filename
        return WIKI.auth.checkAccess(context.req.user, ['read:assets'], { path })
      }).map(a => ({
        ...a,
        kind: a.kind.toUpperCase()
      }))
    },
    async folders(obj, args, context) {
      const results = await WIKI.models.assetFolders.query().where({
        parentId: args.parentFolderId === 0 ? null : args.parentFolderId
      })
      const parentHierarchy = await WIKI.models.assetFolders.getHierarchy(args.parentFolderId)
      const parentPath = parentHierarchy.map(h => h.slug).join('/')
      return _.filter(results, r => {
        const path = parentPath ? `${parentPath}/${r.slug}` : r.slug
        return WIKI.auth.checkAccess(context.req.user, ['read:assets'], { path })
      })
    }
  },
  AssetMutation: {
    /**
     * Create New Asset Folder
     */
    async createFolder(obj, args, context) {
      try {
        const folderSlug = sanitize(args.slug).toLowerCase()
        const parentFolderId = args.parentFolderId === 0 ? null : args.parentFolderId
        const result = await WIKI.models.assetFolders.query().where({
          parentId: parentFolderId,
          slug: folderSlug
        }).first()
        if (!result) {
          await WIKI.models.assetFolders.query().insert({
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

        const asset = await WIKI.models.assets.query().findById(args.id)
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
          const assetCollision = await WIKI.models.assets.query().where({
            filename,
            folderId: asset.folderId
          }).first()
          if (assetCollision) {
            throw new WIKI.Error.AssetRenameCollision()
          }

          // Get asset folder path
          let hierarchy = []
          if (asset.folderId) {
            hierarchy = await WIKI.models.assetFolders.getHierarchy(asset.folderId)
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
          await WIKI.models.assets.query().patch({
            filename: filename,
            hash: fileHash
          }).findById(args.id)

          // Delete old asset cache
          await asset.deleteAssetCache()

          // Rename in Storage
          await WIKI.models.storage.assetEvent({
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
        const asset = await WIKI.models.assets.query().findById(args.id)
        if (asset) {
          // Check permissions
          const assetPath = await asset.getAssetPath()
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetPath })) {
            throw new WIKI.Error.AssetDeleteForbidden()
          }

          await WIKI.models.knex('assetData').where('id', args.id).del()
          await WIKI.models.assets.query().deleteById(args.id)
          await asset.deleteAssetCache()

          // Delete from Storage
          await WIKI.models.storage.assetEvent({
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
     * Fetch remote media and store as asset
     */
    async fetchRemoteAsset(obj, args, context) {
      let tempFilePath = null
      try {
        const user = context.req.user
        const remoteUrlRaw = _.trim(args.url)
        if (!remoteUrlRaw) {
          throw new WIKI.Error.InputInvalid()
        }

        const maxFileSize = _.get(WIKI, 'config.uploads.maxFileSize', 0)
        let targetFolderId = args.folderId === 0 ? null : args.folderId
        let hierarchy = []
        if (targetFolderId) {
          hierarchy = await WIKI.models.assetFolders.getHierarchy(targetFolderId)
          if (hierarchy.length < 1) {
            throw new WIKI.Error.InputInvalid()
          }
        }
        const folderPath = hierarchy.map(h => h.slug).join('/')

        let parsedUrl
        try {
          parsedUrl = new URL(remoteUrlRaw)
        } catch (err) {
          throw new WIKI.Error.InputInvalid()
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new WIKI.Error.InputInvalid()
        }

        const fetchOpts = {
          timeout: REMOTE_FETCH_TIMEOUT
        }
        if (maxFileSize > 0) {
          fetchOpts.size = maxFileSize + 1024
        }

        let response
        try {
          response = await fetch(remoteUrlRaw, fetchOpts)
        } catch (err) {
          throw new WIKI.Error.AssetFetchFailed()
        }

        if (!response.ok) {
          throw new WIKI.Error.AssetFetchFailed()
        }

        const contentLengthHeader = response.headers.get('content-length')
        if (contentLengthHeader && maxFileSize > 0 && _.toInteger(contentLengthHeader) > maxFileSize) {
          throw new WIKI.Error.AssetFetchTooLarge()
        }

        let buffer
        try {
          buffer = await response.buffer()
        } catch (err) {
          if (err && err.type === 'max-size') {
            throw new WIKI.Error.AssetFetchTooLarge()
          }
          throw new WIKI.Error.AssetFetchFailed()
        }

        if (!buffer || buffer.length < 1) {
          throw new WIKI.Error.AssetFetchFailed()
        }
        if (maxFileSize > 0 && buffer.length > maxFileSize) {
          throw new WIKI.Error.AssetFetchTooLarge()
        }

        let mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
        const detectedType = await FileType.fromBuffer(buffer)
        if (detectedType && detectedType.mime) {
          mimeType = detectedType.mime
        }
        if (!mimeType || !_.some(REMOTE_ALLOWED_MIME_PREFIXES, prefix => mimeType.startsWith(prefix))) {
          throw new WIKI.Error.AssetFetchInvalidType()
        }

        const rawUrlSegment = decodeURIComponent(parsedUrl.pathname || '').split('/').filter(Boolean).pop() || ''
        const rawExt = path.extname(rawUrlSegment)
        const rawBase = rawExt ? rawUrlSegment.slice(0, -rawExt.length) : rawUrlSegment
        let sanitizedBase = sanitize(rawBase.toLowerCase().replace(/[\s,;#]+/g, '_'))
        if (!sanitizedBase) {
          sanitizedBase = `remote_asset_${Date.now()}`
        }

        const normalizedRawExt = rawExt.toLowerCase().replace(/^\./, '')
        const mimeExt = mime.extension(mimeType)
        const allowedExts = (mime.extensions && mime.extensions[mimeType]) || []
        let finalExt = ''
        if (
          normalizedRawExt &&
          normalizedRawExt.length <= 8 &&
          (allowedExts.length === 0 || allowedExts.includes(normalizedRawExt))
        ) {
          finalExt = `.${normalizedRawExt}`
        } else if (mimeExt) {
          finalExt = `.${mimeExt}`
        }
        if (!finalExt) {
          throw new WIKI.Error.AssetFetchInvalidType()
        }

        if (sanitizedBase.length + finalExt.length > 255) {
          sanitizedBase = sanitizedBase.substring(0, 255 - finalExt.length)
        }

        let finalName = sanitize(`${sanitizedBase}${finalExt}`).toLowerCase()
        if (!finalName || finalName === finalExt) {
          finalName = `remote_asset_${Date.now()}${finalExt}`
        }
        if (!finalName.endsWith(finalExt)) {
          finalName = `${finalName}${finalExt}`
        }

        const assetPath = folderPath ? `${folderPath}/${finalName}` : finalName
        if (!WIKI.auth.checkAccess(user, ['write:assets'], { path: assetPath })) {
          throw new WIKI.Error.AssetUploadForbidden()
        }

        const uploadsDir = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
        await fs.ensureDir(uploadsDir)
        const tempFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${finalExt}`
        tempFilePath = path.join(uploadsDir, tempFileName)
        await fs.writeFile(tempFilePath, buffer)

        await WIKI.models.assets.upload({
          mode: 'remote',
          originalname: finalName,
          mimetype: mimeType,
          size: buffer.length,
          folderId: targetFolderId,
          path: tempFilePath,
          assetPath,
          user
        })

        await fs.remove(tempFilePath)
        tempFilePath = null

        return {
          responseResult: graphHelper.generateSuccess('Remote asset fetched successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      } finally {
        if (tempFilePath) {
          await fs.remove(tempFilePath).catch(() => {})
        }
      }
    },
    /**
     * Flush Temporary Uploads
     */
    async flushTempUploads(obj, args, context) {
      try {
        await WIKI.models.assets.flushTempUploads()
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
