module.exports = {
  // Query: {
  //   tags(obj, args, context, info) {
  //     return WIKI.models.Tag.findAll({ where: args })
  //   }
  // },
  // Mutation: {
  //   assignTagToDocument(obj, args) {
  //     return WIKI.models.Tag.findById(args.tagId).then(tag => {
  //       if (!tag) {
  //         throw new gql.GraphQLError('Invalid Tag ID')
  //       }
  //       return WIKI.models.Document.findById(args.documentId).then(doc => {
  //         if (!doc) {
  //           throw new gql.GraphQLError('Invalid Document ID')
  //         }
  //         return tag.addDocument(doc)
  //       })
  //     })
  //   },
  //   createTag(obj, args) {
  //     return WIKI.models.Tag.create(args)
  //   },
  //   deleteTag(obj, args) {
  //     return WIKI.models.Tag.destroy({
  //       where: {
  //         id: args.id
  //       },
  //       limit: 1
  //     })
  //   },
  //   removeTagFromDocument(obj, args) {
  //     return WIKI.models.Tag.findById(args.tagId).then(tag => {
  //       if (!tag) {
  //         throw new gql.GraphQLError('Invalid Tag ID')
  //       }
  //       return WIKI.models.Document.findById(args.documentId).then(doc => {
  //         if (!doc) {
  //           throw new gql.GraphQLError('Invalid Document ID')
  //         }
  //         return tag.removeDocument(doc)
  //       })
  //     })
  //   },
  //   renameTag(obj, args) {
  //     return WIKI.models.Group.update({
  //       key: args.key
  //     }, {
  //       where: { id: args.id }
  //     })
  //   }
  // },
  // Tag: {
  //   documents(tag) {
  //     return tag.getDocuments()
  //   }
  // }
}
