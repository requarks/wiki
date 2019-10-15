const graphHelper = require('../../helpers/graph')
const safeRegex = require('safe-regex')
const _ = require('lodash')

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
      const relExist = await WIKI.models.knex('userGroups').where({
        userId: args.userId,
        groupId: args.groupId
      }).first()
      if (relExist) {
        throw new gql.GraphQLError('User is already assigned to group.')
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
        pageRules: JSON.stringify(WIKI.data.groups.defaultPageRules),
        isSystem: false
      })
      await WIKI.auth.reloadGroups()
      return {
        responseResult: graphHelper.generateSuccess('Group created successfully.'),
        group
      }
    },
    async delete(obj, args) {
      await WIKI.models.groups.query().deleteById(args.id)
      await WIKI.auth.reloadGroups()
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
      if (_.some(args.pageRules, pr => {
        return pr.match === 'REGEX' && !safeRegex(pr.path)
      })) {
        throw new gql.GraphQLError('Some Page Rules contains unsafe or exponential time regex.')
      }

      await WIKI.models.groups.query().patch({
        name: args.name,
        permissions: JSON.stringify(args.permissions),
        pageRules: JSON.stringify(args.pageRules)
      }).where('id', args.id)

      await WIKI.auth.reloadGroups()

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
