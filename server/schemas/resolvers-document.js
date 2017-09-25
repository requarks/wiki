
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
    },
    modifyDocument(obj, args) {
      return wiki.db.Document.update({
        title: args.title,
        subtitle: args.subtitle
      }, {
        where: { id: args.id }
      })
    },
    moveDocument(obj, args) {
      return wiki.db.Document.update({
        path: args.path
      }, {
        where: { id: args.id }
      })
    }
  },
  Document: {
    comments(doc) {
      return doc.getComments()
    },
    tags(doc) {
      return doc.getTags()
    }
  }
}
