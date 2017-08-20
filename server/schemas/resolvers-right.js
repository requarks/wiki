'use strict'

/* global wiki */

const gql = require('graphql')

module.exports = {
  Query: {
    rights(obj, args, context, info) {
      return wiki.db.Right.findAll({ where: args })
    }
  },
  Mutation: {
    addRightToGroup(obj, args) {
      return wiki.db.Group.findById(args.groupId).then(grp => {
        if (!grp) {
          throw new gql.GraphQLError('Invalid Group ID')
        }
        return wiki.db.Right.create({
          path: args.path,
          role: args.role,
          exact: args.exact,
          allow: args.allow,
          group: grp
        })
      })
    },
    removeRightFromGroup(obj, args) {
      return wiki.db.Right.destroy({
        where: {
          id: args.rightId
        },
        limit: 1
      })
    },
    modifyRight(obj, args) {
      return wiki.db.Right.update({
        path: args.path,
        role: args.role,
        exact: args.exact,
        allow: args.allow
      }, {
        where: {
          id: args.id
        }
      })
    }
  },
  Right: {
    group(rt) {
      return rt.getGroup()
    }
  }
}
