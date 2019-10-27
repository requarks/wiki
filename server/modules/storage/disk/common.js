const fs = require('fs-extra')
const path = require('path')
const stream = require('stream')
const Promise = require('bluebird')
const pipeline = Promise.promisify(stream.pipeline)
const klaw = require('klaw')
const mime = require('mime-types').lookup
const _ = require('lodash')

const pageHelper = require('../../../helpers/page.js')

/* global WIKI */

module.exports = {
  assetFolders: null,
  async importFromDisk ({ fullPath, moduleName }) {
    const rootUser = await WIKI.models.users.getRootUser()

    await pipeline(
      klaw(fullPath, {
        filter: (f) => {
          return !_.includes(f, '.git')
        }
      }),
      new stream.Transform({
        objectMode: true,
        transform: async (file, enc, cb) => {
          const relPath = file.path.substr(fullPath.length + 1)
          if (file.stats.size < 1) {
            // Skip directories and zero-byte files
            return cb()
          } else if (relPath && relPath.length > 3) {
            WIKI.logger.info(`(STORAGE/${moduleName}) Processing ${relPath}...`)
            const contentType = pageHelper.getContentType(relPath)
            if (contentType) {
              // -> Page

              try {
                await this.processPage({
                  user: rootUser,
                  relPath: relPath,
                  fullPath: fullPath,
                  contentType: contentType,
                  moduleName: moduleName
                })
              } catch (err) {
                WIKI.logger.warn(`(STORAGE/${moduleName}) Failed to process page ${relPath}`)
                WIKI.logger.warn(err)
              }
            } else {
              // -> Asset

              try {
                await this.processAsset({
                  user: rootUser,
                  relPath: relPath,
                  file: file,
                  contentType: contentType,
                  moduleName: moduleName
                })
              } catch (err) {
                WIKI.logger.warn(`(STORAGE/${moduleName}) Failed to process asset ${relPath}`)
                WIKI.logger.warn(err)
              }
            }
          }
          cb()
        }
      })
    )
    this.clearFolderCache()
  },

  async processPage ({ user, fullPath, relPath, contentType, moduleName }) {
    const contentPath = pageHelper.getPagePath(relPath)
    const itemContents = await fs.readFile(path.join(fullPath, relPath), 'utf8')
    const pageData = WIKI.models.pages.parseMetadata(itemContents, contentType)
    const currentPage = await WIKI.models.pages.getPageFromDb({
      path: contentPath.path,
      locale: contentPath.locale
    })
    const newTags = !_.isNil(pageData.tags) ? _.get(pageData, 'tags', '').split(', ') : false
    if (currentPage) {
      // Already in the DB, can mark as modified
      WIKI.logger.info(`(STORAGE/${moduleName}) Page marked as modified: ${relPath}`)
      await WIKI.models.pages.updatePage({
        id: currentPage.id,
        title: _.get(pageData, 'title', currentPage.title),
        description: _.get(pageData, 'description', currentPage.description) || '',
        tags: newTags || currentPage.tags.map(t => t.tag),
        isPublished: _.get(pageData, 'isPublished', currentPage.isPublished),
        isPrivate: false,
        content: pageData.content,
        user: user,
        skipStorage: true
      })
    } else {
      // Not in the DB, can mark as new
      WIKI.logger.info(`(STORAGE/${moduleName}) Page marked as new: ${relPath}`)
      const pageEditor = await WIKI.models.editors.getDefaultEditor(contentType)
      await WIKI.models.pages.createPage({
        path: contentPath.path,
        locale: contentPath.locale,
        title: _.get(pageData, 'title', _.last(contentPath.path.split('/'))),
        description: _.get(pageData, 'description', '') || '',
        tags: newTags || [],
        isPublished: _.get(pageData, 'isPublished', true),
        isPrivate: false,
        content: pageData.content,
        user: user,
        editor: pageEditor,
        skipStorage: true
      })
    }
  },

  async processAsset ({ user, relPath, file, moduleName }) {
    WIKI.logger.info(`(STORAGE/${moduleName}) Asset marked for import: ${relPath}`)

    // -> Get all folder paths
    if (!this.assetFolders) {
      this.assetFolders = await WIKI.models.assetFolders.getAllPaths()
    }

    // -> Find existing folder
    const filePathInfo = path.parse(file.path)
    const folderPath = path.dirname(relPath).replace(/\\/g, '/')
    let folderId = _.toInteger(_.findKey(this.assetFolders, fld => { return fld === folderPath })) || null

    // -> Create missing folder structure
    if (!folderId && folderPath !== '.') {
      const folderParts = folderPath.split('/')
      let currentFolderPath = []
      let currentFolderParentId = null
      for (const folderPart of folderParts) {
        currentFolderPath.push(folderPart)
        const existingFolderId = _.findKey(this.assetFolders, fld => { return fld === currentFolderPath.join('/') })
        if (!existingFolderId) {
          const newFolderObj = await WIKI.models.assetFolders.query().insert({
            slug: folderPart,
            name: folderPart,
            parentId: currentFolderParentId
          })
          _.set(this.assetFolders, newFolderObj.id, currentFolderPath.join('/'))
          currentFolderParentId = newFolderObj.id
        } else {
          currentFolderParentId = _.toInteger(existingFolderId)
        }
      }
      folderId = currentFolderParentId
    }

    // -> Import asset
    await WIKI.models.assets.upload({
      mode: 'import',
      originalname: filePathInfo.base,
      ext: filePathInfo.ext,
      mimetype: mime(filePathInfo.base) || 'application/octet-stream',
      size: file.stats.size,
      folderId: folderId,
      path: file.path,
      assetPath: relPath,
      user: user,
      skipStorage: true
    })
  },

  clearFolderCache () {
    this.assetFolders = null
  }
}
