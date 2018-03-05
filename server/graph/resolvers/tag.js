
/* global WIKI */

const gql = require('graphql')

module.exports = {
  Query: {
    tags(obj, args, context, info) {
      return WIKI.db.Tag.findAll({ where: args })
    }
  },
  Mutation: {
    assignTagToDocument(obj, args) {
      return WIKI.db.Tag.findById(args.tagId).then(tag => {
        if (!tag) {
          throw new gql.GraphQLError('Invalid Tag ID')
        }
        return WIKI.db.Document.findById(args.documentId).then(doc => {
          if (!doc) {
            throw new gql.GraphQLError('Invalid Document ID')
          }
          return tag.addDocument(doc)
        })
      })
    },
    createTag(obj, args) {
      return WIKI.db.Tag.create(args)
    },
    deleteTag(obj, args) {
      return WIKI.db.Tag.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    removeTagFromDocument(obj, args) {
      return WIKI.db.Tag.findById(args.tagId).then(tag => {
        if (!tag) {
          throw new gql.GraphQLError('Invalid Tag ID')
        }
        return WIKI.db.Document.findById(args.documentId).then(doc => {
          if (!doc) {
            throw new gql.GraphQLError('Invalid Document ID')
          }
          return tag.removeDocument(doc)
        })
      })
    },
    renameTag(obj, args) {
      return WIKI.db.Group.update({
        key: args.key
      }, {
        where: { id: args.id }
      })
    }
  },
  Tag: {
    documents(tag) {
      return tag.getDocuments()
    }
  }
}
