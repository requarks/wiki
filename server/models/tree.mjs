import { Model } from 'objection'
import { differenceWith, dropRight, last, nth } from 'lodash-es'
import {
  decodeTreePath,
  encodeTreePath,
  generateHash
} from '../helpers/common.mjs'

import { Site } from './sites.mjs'

const rePathName = /^[a-z0-9-]+$/
const reTitle = /^[^<>"]+$/

/**
 * Tree model
 */
export class Tree extends Model {
  static get tableName () { return 'tree' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['fileName'],

      properties: {
        id: { type: 'string' },
        folderPath: { type: 'string' },
        fileName: { type: 'string' },
        type: { type: 'string' },
        title: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  static get jsonAttributes () {
    return ['meta']
  }

  static get relationMappings () {
    return {
      site: {
        relation: Model.BelongsToOneRelation,
        modelClass: Site,
        join: {
          from: 'tree.siteId',
          to: 'sites.id'
        }
      }
    }
  }

  $beforeUpdate () {
    this.updatedAt = new Date().toISOString()
  }

  $beforeInsert () {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Get a Folder
   *
   * @param {Object} args - Fetch Properties
   * @param {string} [args.id] - UUID of the folder
   * @param {string} [args.path] - Path of the folder
   * @param {string} [args.locale] - Locale code of the folder (when using path)
   * @param {string} [args.siteId] - UUID of the site in which the folder is (when using path)
   * @param {boolean} [args.createIfMissing] - Create the folder and its ancestor if it's missing (when using path)
   */
  static async getFolder ({ id, path, locale, siteId, createIfMissing = false }) {
    // Get by ID
    if (id) {
      const parent = await WIKI.db.knex('tree').where('id', id).first()
      if (!parent) {
        throw new Error('ERR_INVALID_FOLDER')
      }
      return parent
    } else {
      // Get by path
      const parentPath = encodeTreePath(path)
      const parentPathParts = parentPath.split('.')
      const parentFilter = {
        folderPath: dropRight(parentPathParts).join('.'),
        fileName: last(parentPathParts)
      }
      const parent = await WIKI.db.knex('tree').where({
        ...parentFilter,
        type: 'folder',
        locale,
        siteId
      }).first()
      if (parent) {
        return parent
      } else if (createIfMissing) {
        return WIKI.db.tree.createFolder({
          parentPath: parentFilter.folderPath,
          pathName: parentFilter.fileName,
          title: parentFilter.fileName,
          locale,
          siteId
        })
      } else {
        throw new Error('ERR_INVALID_FOLDER')
      }
    }
  }

  /**
   * Add Page Entry
   *
   * @param {Object} args - New Page Properties
   * @param {string} [args.parentId] - UUID of the parent folder
   * @param {string} [args.parentPath] - Path of the parent folder
   * @param {string} args.pathName - Path name of the page to add
   * @param {string} args.title - Title of the page to add
   * @param {string} args.locale - Locale code of the page to add
   * @param {string} args.siteId - UUID of the site in which the page will be added
   * @param {string[]} [args.tags] - Tags of the assets
   * @param {Object} [args.meta] - Extra metadata
   */
  static async addPage ({ id, parentId, parentPath, fileName, title, locale, siteId, tags = [], meta = {} }) {
    const folder = (parentId || parentPath)
      ? await WIKI.db.tree.getFolder({
        id: parentId,
        path: parentPath,
        locale,
        siteId,
        createIfMissing: true
      })
      : {
          folderPath: '',
          fileName: ''
        }
    const folderPath = folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName
    const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName

    WIKI.logger.debug(`Adding page ${fullPath} to tree...`)

    const pageEntry = await WIKI.db.knex('tree').insert({
      id,
      folderPath,
      fileName,
      type: 'page',
      title,
      hash: generateHash(fullPath),
      locale,
      siteId,
      tags,
      meta,
      navigationId: siteId
    }).returning('*')

    return pageEntry[0]
  }

  /**
   * Add Asset Entry
   *
   * @param {Object} args - New Asset Properties
   * @param {string} [args.parentId] - UUID of the parent folder
   * @param {string} [args.parentPath] - Path of the parent folder
   * @param {string} args.pathName - Path name of the asset to add
   * @param {string} args.title - Title of the asset to add
   * @param {string} args.locale - Locale code of the asset to add
   * @param {string} args.siteId - UUID of the site in which the asset will be added
   * @param {string[]} [args.tags] - Tags of the assets
   * @param {Object} [args.meta] - Extra metadata
   */
  static async addAsset ({ id, parentId, parentPath, fileName, title, locale, siteId, tags = [], meta = {} }) {
    const folder = (parentId || parentPath)
      ? await WIKI.db.tree.getFolder({
        id: parentId,
        path: parentPath,
        locale,
        siteId,
        createIfMissing: true
      })
      : {
          folderPath: '',
          fileName: ''
        }
    const folderPath = folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName
    const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName

    WIKI.logger.debug(`Adding asset ${fullPath} to tree...`)

    const assetEntry = await WIKI.db.knex('tree').insert({
      id,
      folderPath,
      fileName,
      type: 'asset',
      title,
      hash: generateHash(fullPath),
      locale,
      siteId,
      tags,
      meta
    }).returning('*')

    return assetEntry[0]
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
      throw new Error('ERR_INVALID_PATH')
    }

    // Validate title
    if (!reTitle.test(title)) {
      throw new Error('ERR_FOLDER_TITLE_INVALID')
    }

    parentPath = encodeTreePath(parentPath)
    WIKI.logger.debug(`Creating new folder ${pathName}...`)
    const parentPathParts = parentPath.split('.')
    const parentFilter = {
      folderPath: dropRight(parentPathParts).join('.'),
      fileName: last(parentPathParts)
    }

    // Get parent path
    let parent = null
    if (parentId) {
      parent = await WIKI.db.knex('tree').where('id', parentId).first()
      if (!parent) {
        throw new Error('ERR_FOLDER_PARENT_INVALID')
      }
      parentPath = parent.folderPath ? `${parent.folderPath}.${parent.fileName}` : parent.fileName
    } else if (parentPath) {
      parent = await WIKI.db.knex('tree').where(parentFilter).first()
    } else {
      parentPath = ''
    }

    // Check for collision
    const existingFolder = await WIKI.db.knex('tree').select('id').where({
      siteId,
      locale,
      folderPath: parentPath,
      fileName: pathName,
      type: 'folder'
    }).first()
    if (existingFolder) {
      throw new Error('ERR_FOLDER_DUPLICATE')
    }

    // Ensure all ancestors exist
    if (parentPath) {
      const expectedAncestors = []
      const existingAncestors = await WIKI.db.knex('tree').select('folderPath', 'fileName').where(builder => {
        const parentPathParts = parentPath.split('.')
        for (let i = 1; i <= parentPathParts.length; i++) {
          const ancestor = {
            folderPath: dropRight(parentPathParts, i).join('.'),
            fileName: nth(parentPathParts, i * -1)
          }
          expectedAncestors.push(ancestor)
          builder.orWhere({
            ...ancestor,
            type: 'folder'
          })
        }
      })
      for (const ancestor of differenceWith(expectedAncestors, existingAncestors, (expAnc, exsAnc) => expAnc.folderPath === exsAnc.folderPath && expAnc.fileName === exsAnc.fileName)) {
        WIKI.logger.debug(`Creating missing parent folder ${ancestor.fileName} at path /${ancestor.folderPath}...`)
        const newAncestorFullPath = ancestor.folderPath ? `${decodeTreePath(ancestor.folderPath)}/${ancestor.fileName}` : ancestor.fileName
        const newAncestor = await WIKI.db.knex('tree').insert({
          ...ancestor,
          type: 'folder',
          title: ancestor.fileName,
          hash: generateHash(newAncestorFullPath),
          locale,
          siteId,
          meta: {
            children: 1
          }
        }).returning('*')

        // Parent didn't exist until now, assign it
        if (!parent && ancestor.folderPath === parentFilter.folderPath && ancestor.fileName === parentFilter.fileName) {
          parent = newAncestor[0]
        }
      }
    }

    // Create folder
    const fullPath = parentPath ? `${decodeTreePath(parentPath)}/${pathName}` : pathName
    const folder = await WIKI.db.knex('tree').insert({
      folderPath: parentPath,
      fileName: pathName,
      type: 'folder',
      title,
      hash: generateHash(fullPath),
      locale,
      siteId,
      meta: {
        children: 0
      }
    }).returning('*')

    // Update parent ancestor count
    if (parent) {
      await WIKI.db.knex('tree').where('id', parent.id).update({
        meta: {
          ...(parent.meta ?? {}),
          children: (parent.meta?.children || 0) + 1
        }
      })
    }

    WIKI.logger.debug(`Created folder ${folder[0].id} successfully.`)

    return folder[0]
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
      throw new Error('ERR_INVALID_FOLDER')
    }

    // Validate path name
    if (!rePathName.test(pathName)) {
      throw new Error('ERR_INVALID_PATH')
    }

    // Validate title
    if (!reTitle.test(title)) {
      throw new Error('ERR_FOLDER_TITLE_INVALID')
    }

    WIKI.logger.debug(`Renaming folder ${folder.id} path to ${pathName}...`)

    if (pathName !== folder.fileName) {
      // Check for collision
      const existingFolder = await WIKI.db.knex('tree')
        .whereNot('id', folder.id)
        .andWhere({
          siteId: folder.siteId,
          folderPath: folder.folderPath,
          fileName: pathName,
          type: 'folder'
        }).first()
      if (existingFolder) {
        throw new Error('ERR_FOLDER_DUPLICATE')
      }

      // Build new paths
      const oldFolderPath = folder.folderPath ? `${folder.folderPath}.${folder.fileName}` : folder.fileName
      const newFolderPath = folder.folderPath ? `${folder.folderPath}.${pathName}` : pathName

      // Update children nodes
      WIKI.logger.debug(`Updating parent path of children nodes from ${oldFolderPath} to ${newFolderPath} ...`)
      await WIKI.db.knex('tree').where('siteId', folder.siteId).andWhere('folderPath', oldFolderPath).update({
        folderPath: newFolderPath
      })
      await WIKI.db.knex('tree').where('siteId', folder.siteId).andWhere('folderPath', '<@', oldFolderPath).update({
        folderPath: WIKI.db.knex.raw(`'${newFolderPath}' || subpath(tree."folderPath", nlevel('${newFolderPath}'))`)
      })

      // Rename the folder itself
      const fullPath = folder.folderPath ? `${folder.folderPath}/${pathName}` : pathName
      await WIKI.db.knex('tree').where('id', folder.id).update({
        fileName: pathName,
        title,
        hash: generateHash(fullPath)
      })
    } else {
      // Update the folder title only
      await WIKI.db.knex('tree').where('id', folder.id).update({
        title
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
      throw new Error('ERR_INVALID_FOLDER')
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
        folderPath: dropRight(parentPathParts).join('.'),
        fileName: last(parentPathParts)
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
