
/* global WIKI */

const gql = require('graphql')

module.exports = {
  Query: {
    async groups() { return {} }
  },
  Mutation: {
    async groups() { return {} }
  },
  GroupQuery: {
    list(obj, args, context, info) {
      return WIKI.db.Group.findAll({ where: args })
    }
  },
  GroupMutation: {
    assignUser(obj, args) {
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
    create(obj, args) {
      return WIKI.db.Group.create(args)
    },
    delete(obj, args) {
      return WIKI.db.Group.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    unassignUser(obj, args) {
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
    update(obj, args) {
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
