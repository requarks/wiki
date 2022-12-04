const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

const typeResolvers = {
  folder: 'TreeItemFolder',
  page: 'TreeItemPage',
  asset: 'TreeItemAsset'
}

const rePathName = /^[a-z0-9_]+$/
const reTitle = /^[^<>"]+$/

module.exports = {
  Query: {
    async tree (obj, args, context, info) {
      // Offset
      const offset = args.offset || 0
      if (offset < 0) {
        throw new Error('Invalid Offset')
      }

      // Limit
      const limit = args.limit || 100
      if (limit < 1 || limit > 100) {
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
          parentPath = parent.folderPath ? `${parent.folderPath}.${parent.fileName}` : parent.fileName
        }
      } else if (args.parentPath) {
        parentPath = args.parentPath.replaceAll('/', '.').replaceAll('-', '_').toLowerCase()
      }
      const folderPathCondition = parentPath ? `${parentPath}.${depthCondition}` : depthCondition

      // Fetch Items
      const items = await WIKI.db.knex('tree')
        .select(WIKI.db.knex.raw('tree.*, nlevel(tree."folderPath") AS depth'))
        .where(builder => {
          builder.where('folderPath', '~', folderPathCondition)
          if (args.includeAncestors) {
            const parentPathParts = parentPath.split('.')
            for (let i = 1; i <= parentPathParts.length; i++) {
              builder.orWhere({
                folderPath: _.dropRight(parentPathParts, i).join('.'),
                fileName: _.nth(parentPathParts, i * -1)
              })
            }
          }
        })
        .andWhere(builder => {
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
        folderPath: item.folderPath.replaceAll('.', '/').replaceAll('_', '-'),
        fileName: item.fileName,
        title: item.title,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ...(item.type === 'folder') && {
          childrenCount: 0
        }
      }))
    }
  },
  Mutation: {
    async createFolder (obj, args, context) {
      try {
        // Get parent path
        let parentPath = ''
        if (args.parentId) {
          const parent = await WIKI.db.knex('tree').where('id', args.parentId).first()
          parentPath = parent ? `${parent.folderPath}.${parent.fileName}` : ''
          if (parent) {
            parentPath = parent.folderPath ? `${parent.folderPath}.${parent.fileName}` : parent.fileName
          }
        }

        // Validate path name
        const pathName = args.pathName.replaceAll('-', '_')
        if (!rePathName.test(pathName)) {
          throw new Error('ERR_INVALID_PATH_NAME')
        }

        // Validate title
        if (!reTitle.test(args.title)) {
          throw new Error('ERR_INVALID_TITLE')
        }

        // Check for collision
        const existingFolder = await WIKI.db.knex('tree').where({
          siteId: args.siteId,
          folderPath: parentPath,
          fileName: pathName
        }).first()
        if (existingFolder) {
          throw new Error('ERR_FOLDER_ALREADY_EXISTS')
        }

        // Create folder
        await WIKI.db.knex('tree').insert({
          folderPath: parentPath,
          fileName: pathName,
          type: 'folder',
          title: args.title,
          siteId: args.siteId
        })
        return {
          operation: graphHelper.generateSuccess('Folder created successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  TreeItem: {
    __resolveType (obj, context, info) {
      return typeResolvers[obj.type] ?? null
    }
  }
}
