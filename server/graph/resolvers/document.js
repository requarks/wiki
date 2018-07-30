
/* global WIKI */

module.exports = {
  Query: {
    documents(obj, args, context, info) {
      return WIKI.models.Document.findAll({ where: args })
    }
  },
  Mutation: {
    createDocument(obj, args) {
      return WIKI.models.Document.create(args)
    },
    deleteDocument(obj, args) {
      return WIKI.models.Document.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    modifyDocument(obj, args) {
      return WIKI.models.Document.update({
        title: args.title,
        subtitle: args.subtitle
      }, {
        where: { id: args.id }
      })
    },
    moveDocument(obj, args) {
      return WIKI.models.Document.update({
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
