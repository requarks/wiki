const sanitize = require('sanitize-filename')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

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
      const result = await WIKI.models.assets.query().where(cond)
      return result.map(a => ({
        ...a,
        kind: a.kind.toUpperCase()
      }))
    },
    async folders(obj, args, context) {
      const result = await WIKI.models.assetFolders.query().where({
        parentId: args.parentFolderId === 0 ? null : args.parentFolderId
      })
      // TODO: Filter by page rules
      return result
    }
  },
  AssetMutation: {
    async createFolder(obj, args, context) {
      try {
        const folderSlug = sanitize(args.slug).toLowerCase()
        const parentFolderId = args.parentFolderId === 0 ? null : args.parentFolderId
        const result =  await WIKI.models.assetFolders.query().where({
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
    }
    // deleteFile(obj, args) {
    //   return WIKI.models.File.destroy({
    //     where: {
    //       id: args.id
    //     },
    //     limit: 1
    //   })
    // },
    // renameFile(obj, args) {
    //   return WIKI.models.File.update({
    //     filename: args.filename
    //   }, {
    //     where: { id: args.id }
    //   })
    // },
    // moveFile(obj, args) {
    //   return WIKI.models.File.findById(args.fileId).then(fl => {
    //     if (!fl) {
    //       throw new gql.GraphQLError('Invalid File ID')
    //     }
    //     return WIKI.models.Folder.findById(args.folderId).then(fld => {
    //       if (!fld) {
    //         throw new gql.GraphQLError('Invalid Folder ID')
    //       }
    //       return fl.setFolder(fld)
    //     })
    //   })
    // }
  }
  // File: {
  //   folder(fl) {
  //     return fl.getFolder()
  //   }
  // }
}
