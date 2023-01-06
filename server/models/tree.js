const Model = require('objection').Model
const _ = require('lodash')

const rePathName = /^[a-z0-9-]+$/
const reTitle = /^[^<>"]+$/

/**
 * Tree model
 */
module.exports = class Tree extends Model {
  static get tableName() { return 'tree' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['fileName'],

      properties: {
        id: {type: 'string'},
        folderPath: {type: 'string'},
        fileName: {type: 'string'},
        type: {type: 'string'},
        title: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['meta']
  }

  static get relationMappings() {
    return {
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./locales'),
        join: {
          from: 'tree.localeCode',
          to: 'locales.code'
        }
      },
      site: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./sites'),
        join: {
          from: 'tree.siteId',
          to: 'sites.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Create New Folder
   *
   * @param {Object} args - New Folder Properties
   * @param {string} [args.parentId] - UUID of the parent folder
   * @param {string} [args.parentPath] - Path of the parent folder
   * @param {string} args.pathName - Path name of the folder to create
   * @param {string} args.title - Title of the folder to create
   * @param {string} args.locale - Locale code of the folder to create
   * @param {string} args.siteId - UUID of the site in which the folder will be created
   */
  static async createFolder ({ parentId, parentPath, pathName, title, locale, siteId }) {
    // Validate path name
    if (!rePathName.test(pathName)) {
      throw new Error('ERR_INVALID_PATH_NAME')
    }

    // Validate title
    if (!reTitle.test(title)) {
      throw new Error('ERR_INVALID_TITLE')
    }

    WIKI.logger.debug(`Creating new folder ${pathName}...`)
    parentPath = parentPath?.replaceAll('/', '.')?.replaceAll('-', '_') || ''
    const parentPathParts = parentPath.split('.')
    const parentFilter = {
      folderPath: _.dropRight(parentPathParts).join('.'),
      fileName: _.last(parentPathParts)
    }

    // Get parent path
    let parent = null
    if (parentId) {
      parent = await WIKI.db.knex('tree').where('id', parentId).first()
      if (!parent) {
        throw new Error('ERR_NONEXISTING_PARENT_ID')
      }
      parentPath = parent.folderPath ? `${parent.folderPath}.${parent.fileName}` : parent.fileName
    } else if (parentPath) {
      parent = await WIKI.db.knex('tree').where(parentFilter).first()
    } else {
      parentPath = ''
    }

    // Check for collision
    const existingFolder = await WIKI.db.knex('tree').where({
      siteId: siteId,
      localeCode: locale,
      folderPath: parentPath,
      fileName: pathName
    }).first()
    if (existingFolder) {
      throw new Error('ERR_FOLDER_ALREADY_EXISTS')
    }

    // Ensure all ancestors exist
    if (parentPath) {
      const expectedAncestors = []
      const existingAncestors = await WIKI.db.knex('tree').select('folderPath', 'fileName').where(builder => {
        const parentPathParts = parentPath.split('.')
        for (let i = 1; i <= parentPathParts.length; i++) {
          const ancestor = {
            folderPath: _.dropRight(parentPathParts, i).join('.'),
            fileName: _.nth(parentPathParts, i * -1)
          }
          expectedAncestors.push(ancestor)
          builder.orWhere({
            ...ancestor,
            type: 'folder'
          })
        }
      })
      for (const ancestor of _.differenceWith(expectedAncestors, existingAncestors, (expAnc, exsAnc) => expAnc.folderPath === exsAnc.folderPath && expAnc.fileName === exsAnc.fileName)) {
        WIKI.logger.debug(`Creating missing parent folder ${ancestor.fileName} at path /${ancestor.folderPath}...`)
        const newAncestor = await WIKI.db.knex('tree').insert({
          ...ancestor,
          type: 'folder',
          title: ancestor.fileName,
          localeCode: locale,
          siteId: siteId,
          meta: {
            children: 1
          }
        }).returning('*')

        // Parent didn't exist until now, assign it
        if (!parent && ancestor.folderPath === parentFilter.folderPath && ancestor.fileName === parentFilter.fileName) {
          parent = newAncestor
        }
      }
    }

    // Create folder
    WIKI.logger.debug(`Creating new folder ${pathName} at path /${parentPath}...`)
    await WIKI.db.knex('tree').insert({
      folderPath: parentPath,
      fileName: pathName,
      type: 'folder',
      title: title,
      localeCode: locale,
      siteId: siteId,
      meta: {
        children: 0
      }
    })

    // Update parent ancestor count
    if (parent) {
      await WIKI.db.knex('tree').where('id', parent.id).update({
        meta: {
          ...(parent.meta ?? {}),
          children: (parent.meta?.children || 0) + 1
        }
      })
    }
  }

  /**
   * Rename a folder
   *
   * @param {Object} args - Rename Folder Properties
   * @param {string} args.folderId - UUID of the folder to rename
   * @param {string} args.pathName - New path name of the folder
   * @param {string} args.title - New title of the folder
   */
  static async renameFolder ({ folderId, pathName, title }) {
    // Get folder
    const folder = await WIKI.db.knex('tree').where('id', folderId).first()
    if (!folder) {
      throw new Error('ERR_NONEXISTING_FOLDER_ID')
    }

    // Validate path name
    if (!rePathName.test(pathName)) {
      throw new Error('ERR_INVALID_PATH_NAME')
    }

    // Validate title
    if (!reTitle.test(title)) {
      throw new Error('ERR_INVALID_TITLE')
    }

    WIKI.logger.debug(`Renaming folder ${folder.id} path to ${pathName}...`)

    if (pathName !== folder.fileName) {
      // Check for collision
      const existingFolder = await WIKI.db.knex('tree')
        .whereNot('id', folder.id)
        .andWhere({
          siteId: folder.siteId,
          folderPath: folder.folderPath,
          fileName: pathName
        }).first()
      if (existingFolder) {
        throw new Error('ERR_FOLDER_ALREADY_EXISTS')
      }

      // Build new paths
      const oldFolderPath = (folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName).replaceAll('-', '_')
      const newFolderPath = (folder.folderPath ? `${folder.folderPath}.${pathName}` : pathName).replaceAll('-', '_')

      // Update children nodes
      WIKI.logger.debug(`Updating parent path of children nodes from ${oldFolderPath} to ${newFolderPath} ...`)
      await WIKI.db.knex('tree').where('siteId', folder.siteId).andWhere('folderPath', oldFolderPath).update({
        folderPath: newFolderPath
      })
      await WIKI.db.knex('tree').where('siteId', folder.siteId).andWhere('folderPath', '<@', oldFolderPath).update({
        folderPath: WIKI.db.knex.raw(`'${newFolderPath}' || subpath(tree."folderPath", nlevel('${newFolderPath}'))`)
      })

      // Rename the folder itself
      await WIKI.db.knex('tree').where('id', folder.id).update({
        fileName: pathName,
        title: title
      })
    } else {
      // Update the folder title only
      await WIKI.db.knex('tree').where('id', folder.id).update({
        title: title
      })
    }

    WIKI.logger.debug(`Renamed folder ${folder.id} successfully.`)
  }

  /**
   * Delete a folder
   *
   * @param {String} folderId Folder ID
   */
  static async deleteFolder (folderId) {
    // Get folder
    const folder = await WIKI.db.knex('tree').where('id', folderId).first()
    if (!folder) {
      throw new Error('ERR_NONEXISTING_FOLDER_ID')
    }
    const folderPath = folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName
    WIKI.logger.debug(`Deleting folder ${folder.id} at path ${folderPath}...`)

    // Delete all children
    const deletedNodes = await WIKI.db.knex('tree').where('folderPath', '<@', folderPath).del().returning(['id', 'type'])

    // Delete folders
    const deletedFolders = deletedNodes.filter(n => n.type === 'folder').map(n => n.id)
    if (deletedFolders.length > 0) {
      WIKI.logger.debug(`Deleted ${deletedFolders.length} children folders.`)
    }

    // Delete pages
    const deletedPages = deletedNodes.filter(n => n.type === 'page').map(n => n.id)
    if (deletedPages.length > 0) {
      WIKI.logger.debug(`Deleting ${deletedPages.length} children pages...`)

      // TODO: Delete page
    }

    // Delete assets
    const deletedAssets = deletedNodes.filter(n => n.type === 'asset').map(n => n.id)
    if (deletedAssets.length > 0) {
      WIKI.logger.debug(`Deleting ${deletedPages.length} children assets...`)

      // TODO: Delete asset
    }

    // Delete the folder itself
    await WIKI.db.knex('tree').where('id', folder.id).del()

    // Update parent children count
    if (folder.folderPath) {
      const parentPathParts = folder.folderPath.split('.')
      const parent = await WIKI.db.knex('tree').where({
        folderPath: _.dropRight(parentPathParts).join('.'),
        fileName: _.last(parentPathParts)
      }).first()
      await WIKI.db.knex('tree').where('id', parent.id).update({
        meta: {
          ...(parent.meta ?? {}),
          children: (parent.meta?.children || 1) - 1
        }
      })
    }

    WIKI.logger.debug(`Deleted folder ${folder.id} successfully.`)
  }
}
