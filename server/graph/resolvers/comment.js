module.exports = {
  // Query: {
  //   comments(obj, args, context, info) {
  //     return WIKI.models.Comment.findAll({ where: args })
  //   }
  // },
  // Mutation: {
  //   createComment(obj, args) {
  //     return WIKI.models.Comment.create({
  //       content: args.content,
  //       author: args.userId,
  //       document: args.documentId
  //     })
  //   },
  //   deleteComment(obj, args) {
  //     return WIKI.models.Comment.destroy({
  //       where: {
  //         id: args.id
  //       },
  //       limit: 1
  //     })
  //   },
  //   modifyComment(obj, args) {
  //     return WIKI.models.Comment.update({
  //       content: args.content
  //     }, {
  //       where: { id: args.id }
  //     })
  //   }
  // },
  // Comment: {
  //   author(cm) {
  //     return cm.getAuthor()
  //   },
  //   document(cm) {
  //     return cm.getDocument()
  //   }
  // }
}
