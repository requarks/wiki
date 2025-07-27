import _ from 'lodash-es'
import {
  decodeTreePath,
  encodeTreePath
} from '../../helpers/common.mjs'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'

const typeResolvers = {
  folder: 'TreeItemFolder',
  page: 'TreeItemPage',
  asset: 'TreeItemAsset'
}

const rePathName = /^[a-z0-9-]+$/
const reTitle = /^[^<>"]+$/

export default {
  Query: {
    /**
     * FETCH TREE
     */
    async tree (obj, args, context, info) {
      // Offset
      const offset = args.offset || 0
      if (offset < 0) {
        throw new Error('Invalid Offset')
      }

      // Limit
      const limit = args.limit || 1000
      if (limit < 1 || limit > 1000) {
        throw new Error('Invalid Limit')
      }

      // Order By
      const orderByDirection = args.orderByDirection || 'asc'
      const orderBy = args.orderBy || 'title'

      // Parse depth
      const depth = args.depth || 0
      if (depth < 0 || depth > 10) {
        throw new Error('Invalid Depth')
      }
      const depthCondition = depth > 0 ? `*{,${depth}}` : '*{0}'

      // Get parent path
      let parentPath = ''
      if (args.parentId) {
        const parent = await WIKI.db.knex('tree').where('id', args.parentId).first()
        if (parent) {
          parentPath = (parent.folderPath ? `${parent.folderPath}.${parent.fileName}` : parent.fileName)
        }
      } else if (args.parentPath) {
        parentPath = encodeTreePath(args.parentPath)
      }
      const folderPathCondition = parentPath ? `${parentPath}.${depthCondition}` : depthCondition

      // Fetch Items
      const items = await WIKI.db.knex('tree')
        .select(WIKI.db.knex.raw('tree.*, nlevel(tree."folderPath") AS depth'))
        .where(builder => {
          builder.where('folderPath', '~', folderPathCondition)
          // -> Include ancestors
          if (args.includeAncestors) {
            const parentPathParts = parentPath.split('.')
            for (let i = 0; i <= parentPathParts.length; i++) {
              builder.orWhere({
                folderPath: _.dropRight(parentPathParts, i).join('.'),
                fileName: _.nth(parentPathParts, i * -1),
                type: 'folder'
              })
            }
          }
          // -> Include root items
          if (args.includeRootFolders) {
            builder.orWhere({
              folderPath: '',
              type: 'folder'
            })
          }

          // -> Filter by tags
          if (args.tags && args.tags.length > 0) {
            builder.where('tags', '@>', args.tags)
          }
        })
        .andWhere(builder => {
          // -> Limit to specific types
          if (args.types && args.types.length > 0) {
            builder.whereIn('type', args.types)
          }
        })
        .limit(limit)
        .offset(offset)
        .orderBy([
          { column: 'depth' },
          { column: orderBy, order: orderByDirection }
        ])

      return items.map(item => ({
        id: item.id,
        depth: item.depth,
        type: item.type,
        folderPath: decodeTreePath(item.folderPath),
        fileName: item.fileName,
        title: item.title,
        tags: item.tags ?? [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ...(item.type === 'folder') && {
          childrenCount: item.meta?.children || 0,
          isAncestor: item.folderPath.length < parentPath.length
        },
        ...(item.type === 'asset') && {
          fileSize: item.meta?.fileSize || 0,
          fileExt: item.meta?.fileExt || '',
          mimeType: item.meta?.mimeType || ''
        },
        ...(item.type === 'page') && {
          description: item.meta?.description || ''
        }
      }))
    },
    /**
     * FETCH SINGLE FOLDER BY ID
     */
    async folderById (obj, args, context) {
      const folder = await WIKI.db.knex('tree')
        .select(WIKI.db.knex.raw('tree.*, nlevel(tree."folderPath") AS depth'))
        .where('id', args.id)
        .first()

      if (!folder) {
        throw new Error('ERR_INVALID_FOLDER')
      }

      return {
        ...folder,
        folderPath: folder.folderPath.replaceAll('.', '/').replaceAll('_', '-'),
        childrenCount: folder.meta?.children || 0
      }
    },
    /**
     * FETCH SINGLE FOLDER BY PATH
     */
    async folderByPath (obj, args, context) {
      const parentPathParts = args.path.replaceAll('/', '.').replaceAll('-', '_').split('.')
      const folder = await WIKI.db.knex('tree')
        .select(WIKI.db.knex.raw('tree.*, nlevel(tree."folderPath") AS depth'))
        .where({
          siteId: args.siteId,
          locale: args.locale,
          folderPath: _.dropRight(parentPathParts).join('.'),
          fileName: _.last(parentPathParts)
        })
        .first()

      if (!folder) {
        throw new Error('ERR_INVALID_FOLDER')
      }

      return {
        ...folder,
        folderPath: folder.folderPath.replaceAll('.', '/').replaceAll('_', '-'),
        childrenCount: folder.meta?.children || 0
      }
    }
  },
  Mutation: {
    /**
     * CREATE FOLDER
     */
    async createFolder (obj, args, context) {
      try {
        await WIKI.db.tree.createFolder(args)

        return {
          operation: generateSuccess('Folder created successfully')
        }
      } catch (err) {
        WIKI.logger.debug(`Failed to create folder: ${err.message}`)
        return generateError(err)
      }
    },
    /**
     * RENAME FOLDER
     */
    async renameFolder (obj, args, context) {
      try {
        await WIKI.db.tree.renameFolder(args)

        return {
          operation: generateSuccess('Folder renamed successfully')
        }
      } catch (err) {
        WIKI.logger.debug(`Failed to rename folder ${args.folderId}: ${err.message}`)
        return generateError(err)
      }
    },
    /**
     * DELETE FOLDER
     */
    async deleteFolder (obj, args, context) {
      try {
        await WIKI.db.tree.deleteFolder(args.folderId)

        return {
          operation: generateSuccess('Folder deleted successfully')
        }
      } catch (err) {
        WIKI.logger.debug(`Failed to delete folder ${args.folderId}: ${err.message}`)
        return generateError(err)
      }
    }
  },
  TreeItem: {
    __resolveType (obj, context, info) {
      return typeResolvers[obj.type] ?? null
    }
  }
}
