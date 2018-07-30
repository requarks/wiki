
/* global WIKI */

const gql = require('graphql')

module.exports = {
  Query: {
    rights(obj, args, context, info) {
      return WIKI.models.Right.findAll({ where: args })
    }
  },
  Mutation: {
    addRightToGroup(obj, args) {
      return WIKI.models.Group.findById(args.groupId).then(grp => {
        if (!grp) {
          throw new gql.GraphQLError('Invalid Group ID')
        }
        return WIKI.models.Right.create({
          path: args.path,
          role: args.role,
          exact: args.exact,
          allow: args.allow,
          group: grp
        })
      })
    },
    removeRightFromGroup(obj, args) {
      return WIKI.models.Right.destroy({
        where: {
          id: args.rightId
        },
        limit: 1
      })
    },
    modifyRight(obj, args) {
      return WIKI.models.Right.update({
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
