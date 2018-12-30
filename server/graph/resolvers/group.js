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
      return WIKI.models.groups.query().select(
        'groups.*',
        WIKI.models.groups.relatedQuery('users').count().as('userCount')
      )
    },
    async single(obj, args, context, info) {
      return WIKI.models.groups.query().findById(args.id)
    }
  },
  GroupMutation: {
    async assignUser(obj, args) {
      const grp = await WIKI.models.groups.query().findById(args.groupId)
      if (!grp) {
        throw new gql.GraphQLError('Invalid Group ID')
      }
      const usr = await WIKI.models.users.query().findById(args.userId)
      if (!usr) {
        throw new gql.GraphQLError('Invalid User ID')
      }
      await grp.$relatedQuery('users').relate(usr.id)
      return {
        responseResult: graphHelper.generateSuccess('User has been assigned to group.')
      }
    },
    async create(obj, args) {
      const group = await WIKI.models.groups.query().insertAndFetch({
        name: args.name,
        permissions: JSON.stringify(WIKI.data.groups.defaultPermissions),
        pageRules: JSON.stringify([]),
        isSystem: false
      })
      return {
        responseResult: graphHelper.generateSuccess('Group created successfully.'),
        group
      }
    },
    async delete(obj, args) {
      await WIKI.models.groups.query().deleteById(args.id)
      return {
        responseResult: graphHelper.generateSuccess('Group has been deleted.')
      }
    },
    async unassignUser(obj, args) {
      const grp = await WIKI.models.groups.query().findById(args.groupId)
      if (!grp) {
        throw new gql.GraphQLError('Invalid Group ID')
      }
      const usr = await WIKI.models.users.query().findById(args.userId)
      if (!usr) {
        throw new gql.GraphQLError('Invalid User ID')
      }
      await grp.$relatedQuery('users').unrelate().where('userId', usr.id)
      return {
        responseResult: graphHelper.generateSuccess('User has been unassigned from group.')
      }
    },
    async update(obj, args) {
      await WIKI.models.groups.query().patch({
        name: args.name,
        permissions: JSON.stringify(args.permissions),
        pageRules: JSON.stringify(args.pageRules)
      }).where('id', args.id)
      return {
        responseResult: graphHelper.generateSuccess('Group has been updated.')
      }
    }
  },
  Group: {
    users(grp) {
      return grp.$relatedQuery('users')
    }
  }
}
