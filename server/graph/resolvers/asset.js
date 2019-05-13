
/* global WIKI */

const gql = require('graphql')

module.exports = {
  Query: {
    async assets() { return {} }
  },
  Mutation: {
    async assets() { return {} }
  },
  AssetQuery: {
    async list(obj, args, context) {
      const result = await WIKI.models.assets.query().where({
        folderId: null,
        kind: args.kind.toLowerCase()
      })
      return result.map(a => ({
        ...a,
        kind: a.kind.toUpperCase()
      }))
    }
  },
  AssetMutation: {
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
