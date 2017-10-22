
/* global wiki */

module.exports = {
  Query: {
    comments(obj, args, context, info) {
      return wiki.db.Comment.findAll({ where: args })
    }
  },
  Mutation: {
    createComment(obj, args) {
      return wiki.db.Comment.create({
        content: args.content,
        author: args.userId,
        document: args.documentId
      })
    },
    deleteComment(obj, args) {
      return wiki.db.Comment.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    modifyComment(obj, args) {
      return wiki.db.Comment.update({
        content: args.content
      }, {
        where: { id: args.id }
      })
    }
  },
  Comment: {
    author(cm) {
      return cm.getAuthor()
    },
    document(cm) {
      return cm.getDocument()
    }
  }
}
