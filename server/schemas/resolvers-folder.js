'use strict'

/* global wiki */

module.exports = {
  Query: {
    folders(obj, args, context, info) {
      return wiki.db.Folder.findAll({ where: args })
    }
  },
  Mutation: {
    createFolder(obj, args) {
      return wiki.db.Folder.create(args)
    },
    deleteGroup(obj, args) {
      return wiki.db.Folder.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    }
  },
  Folder: {
    files(grp) {
      return grp.getFiles()
    }
  }
}
