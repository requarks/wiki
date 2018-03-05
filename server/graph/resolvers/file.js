
/* global WIKI */

const gql = require('graphql')

module.exports = {
  Query: {
    files(obj, args, context, info) {
      return WIKI.db.File.findAll({ where: args })
    }
  },
  Mutation: {
    uploadFile(obj, args) {
      // todo
      return WIKI.db.File.create(args)
    },
    deleteFile(obj, args) {
      return WIKI.db.File.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    renameFile(obj, args) {
      return WIKI.db.File.update({
        filename: args.filename
      }, {
        where: { id: args.id }
      })
    },
    moveFile(obj, args) {
      return WIKI.db.File.findById(args.fileId).then(fl => {
        if (!fl) {
          throw new gql.GraphQLError('Invalid File ID')
        }
        return WIKI.db.Folder.findById(args.folderId).then(fld => {
          if (!fld) {
            throw new gql.GraphQLError('Invalid Folder ID')
          }
          return fl.setFolder(fld)
        })
      })
    }
  },
  File: {
    folder(fl) {
      return fl.getFolder()
    }
  }
}
