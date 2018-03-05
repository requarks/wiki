
/* global WIKI */

const gql = require('graphql')

module.exports = {
  Query: {
    groups(obj, args, context, info) {
      return WIKI.db.Group.findAll({ where: args })
    }
  },
  Mutation: {
    assignUserToGroup(obj, args) {
      return WIKI.db.Group.findById(args.groupId).then(grp => {
        if (!grp) {
          throw new gql.GraphQLError('Invalid Group ID')
        }
        return WIKI.db.User.findById(args.userId).then(usr => {
          if (!usr) {
            throw new gql.GraphQLError('Invalid User ID')
          }
          return grp.addUser(usr)
        })
      })
    },
    createGroup(obj, args) {
      return WIKI.db.Group.create(args)
    },
    deleteGroup(obj, args) {
      return WIKI.db.Group.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    removeUserFromGroup(obj, args) {
      return WIKI.db.Group.findById(args.groupId).then(grp => {
        if (!grp) {
          throw new gql.GraphQLError('Invalid Group ID')
        }
        return WIKI.db.User.findById(args.userId).then(usr => {
          if (!usr) {
            throw new gql.GraphQLError('Invalid User ID')
          }
          return grp.removeUser(usr)
        })
      })
    },
    renameGroup(obj, args) {
      return WIKI.db.Group.update({
        name: args.name
      }, {
        where: { id: args.id }
      })
    }
  },
  Group: {
    users(grp) {
      return grp.getUsers()
    }
  }
}
