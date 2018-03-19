
/* global WIKI */

module.exports = {
  Query: {
    folders(obj, args, context, info) {
      return WIKI.db.Folder.findAll({ where: args })
    }
  },
  Mutation: {
    createFolder(obj, args) {
      return WIKI.db.Folder.create(args)
    },
    deleteFolder(obj, args) {
      return WIKI.db.Folder.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    renameFolder(obj, args) {
      return WIKI.db.Folder.update({
        name: args.name
      }, {
        where: { id: args.id }
      })
    }
  },
  Folder: {
    files(grp) {
      return grp.getFiles()
    }
  }
}
