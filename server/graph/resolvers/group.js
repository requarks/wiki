const graphHelper = require('../../helpers/graph')

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
    async list(obj, args, context, info) {
      return WIKI.db.Group.findAll({
        attributes: {
          include: [[WIKI.db.inst.fn('COUNT', WIKI.db.inst.col('users.id')), 'userCount']]
        },
        include: [{
          model: WIKI.db.User,
          attributes: [],
          through: {
            attributes: []
          }
        }],
        raw: true,
        // TODO: Figure out how to exclude these extra fields...
        group: ['group.id', 'users->userGroups.createdAt', 'users->userGroups.updatedAt', 'users->userGroups.version', 'users->userGroups.userId', 'users->userGroups.groupId']
      })
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
    async create(obj, args) {
      const group = await WIKI.db.Group.create({
        name: args.name
      })
      console.info(group)
      return {
        responseResult: graphHelper.generateSuccess('Group created successfully.'),
        group
      }
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
