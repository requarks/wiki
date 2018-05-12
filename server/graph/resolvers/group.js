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
    },
    async single(obj, args, context, info) {
      return WIKI.db.Group.findById(args.id)
    }
  },
  GroupMutation: {
    async assignUser(obj, args) {
      const grp = await WIKI.db.Group.findById(args.groupId)
      if (!grp) {
        throw new gql.GraphQLError('Invalid Group ID')
      }
      const usr = await WIKI.db.User.findById(args.userId)
      if (!usr) {
        throw new gql.GraphQLError('Invalid User ID')
      }
      await grp.addUser(usr)
      return {
        responseResult: graphHelper.generateSuccess('User has been assigned to group.')
      }
    },
    async create(obj, args) {
      const group = await WIKI.db.Group.create({
        name: args.name
      })
      return {
        responseResult: graphHelper.generateSuccess('Group created successfully.'),
        group
      }
    },
    async delete(obj, args) {
      await WIKI.db.Group.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
      return {
        responseResult: graphHelper.generateSuccess('Group has been deleted.')
      }
    },
    async unassignUser(obj, args) {
      const grp = await WIKI.db.Group.findById(args.groupId)
      if (!grp) {
        throw new gql.GraphQLError('Invalid Group ID')
      }
      const usr = await WIKI.db.User.findById(args.userId)
      if (!usr) {
        throw new gql.GraphQLError('Invalid User ID')
      }
      await grp.removeUser(usr)
      return {
        responseResult: graphHelper.generateSuccess('User has been unassigned from group.')
      }
    },
    async update(obj, args) {
      await WIKI.db.Group.update({
        name: args.name
      }, {
        where: { id: args.id }
      })
      return {
        responseResult: graphHelper.generateSuccess('Group has been updated.')
      }
    }
  },
  Group: {
    users(grp) {
      return grp.getUsers()
    }
  }
}
