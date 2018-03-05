
/* global WIKI */

module.exports = {
  Query: {
    comments(obj, args, context, info) {
      return WIKI.db.Comment.findAll({ where: args })
    }
  },
  Mutation: {
    createComment(obj, args) {
      return WIKI.db.Comment.create({
        content: args.content,
        author: args.userId,
        document: args.documentId
      })
    },
    deleteComment(obj, args) {
      return WIKI.db.Comment.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    modifyComment(obj, args) {
      return WIKI.db.Comment.update({
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
