'use strict'

/* global wiki */

module.exports = {
  Query: {
    documents(obj, args, context, info) {
      return wiki.db.Document.findAll({ where: args })
    }
  },
  Mutation: {
    createDocument(obj, args) {
      return wiki.db.Document.create(args)
    },
    deleteDocument(obj, args) {
      return wiki.db.Document.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    }
  },
  Document: {
    tags(doc) {
      return doc.getTags()
    }
  }
}
