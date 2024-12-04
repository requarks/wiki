const graphHelper = require('../../helpers/graph')
const safeRegex = require('safe-regex')
const _ = require('lodash')
const gql = require('graphql')

/* global WIKI */

const rulesToSites = (rules) => {
  let siteIds = []

  for (const rule of rules) {
    if (
      rule.deny === false &&
      rule.sites &&
      rule.sites.length > 0 &&
      rule.roles.includes('manage:sites')
    ) {
      siteIds = siteIds.concat(rule.sites)
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const groupsToSites = (groups) => {
  let siteIds = []

  for (const groupId of groups) {
    const group = _.get(WIKI.auth.groups, groupId, [])
    if (group.rules) {
      for (const rule of group.rules) {
        if (
          rule.deny === false &&
          rule.sites &&
          rule.sites.length > 0 &&
          rule.roles.includes('manage:sites')
        ) {
          siteIds = siteIds.concat(rule.sites)
        }
      }
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const rulesToSitesNonAdmin = (rules) => {
  let siteIds = []

  for (const rule of rules) {
    if (
      rule.deny === false &&
      rule.sites &&
      rule.sites.length > 0
    ) {
      siteIds = siteIds.concat(rule.sites)
    }
  }

  siteIds = _.uniq(siteIds)
  return siteIds
}

const isGroupParticipant = (user, groupIds) => {
  return _.intersection(user.groups, groupIds).length > 0
}

const canManageGroup = (user, groupId) => {
  if (WIKI.auth.isSuperAdmin(user)) return true
  if (!isGroupParticipant(user, [groupId])) return false
  const userSites = groupsToSites(user.groups)
  const group = _.get(WIKI.auth.groups, groupId, [])
  const groupSites = rulesToSitesNonAdmin(group.rules)

  if (_.intersection(userSites, groupSites).length === groupSites.length) {
    return true
  }
  return false
}

const canManageSites = (g) => {
  if (_.intersection(g.permissions, ['manage:sites']).length < 1) {
    return false
  }

  for (const rule of g.rules) {
    if (_.intersection(rule.roles, ['manage:sites']).length > 0) {
      return true
    }
  }

  return false
}

module.exports = {
  Query: {
    async groups () { return {} }
  },
  Mutation: {
    async groups () { return {} }
  },
  GroupQuery: {
    /**
     * FETCH ALL GROUPS
     */
    async list (obj, args, { req }) {
      const groups = await WIKI.models.groups.query().select(
        'groups.*',
        WIKI.models.groups.relatedQuery('users').count().as('userCount')
      )

      if (WIKI.auth.isSuperAdmin(req.user)) {
        return groups
      }

      const filteredGroups = _.filter(
        groups,
        g => isGroupParticipant(req.user, [g.id]) && canManageGroup(req.user, g.id)
      )

      return filteredGroups
    },
    /**
     * FETCH A SINGLE GROUP
     */
    async single(obj, args, { req }) {
      const fetchGroupById = (id) => WIKI.models.groups.query().findById(id)

      if (WIKI.auth.isSuperAdmin(req.user)) {
        return fetchGroupById(args.id)
      }

      if (isGroupParticipant(req.user, [args.id]) && canManageGroup(req.user, args.id)) {
        return fetchGroupById(args.id)
      }

      throw new gql.GraphQLError('Insufficient permissions to list the group properties.')
    }
  },
  GroupMutation: {
    /**
     * ASSIGN USER TO GROUP
     */
    async assignUser (obj, args, { req }) {
      if (!canManageGroup(req.user, args.groupId)) {
        throw new gql.GraphQLError('Insufficient permissions to assign user to the group.')
      }

      // Check for guest user
      if (args.userId === 2) {
        throw new gql.GraphQLError('Cannot assign the Guest user to a group.')
      }

      // Check for valid group
      const grp = await WIKI.models.groups.query().findById(args.groupId)
      if (!grp) {
        throw new gql.GraphQLError('Invalid Group ID')
      }

      // Check assigned permissions for write:groups
      if (
        WIKI.auth.checkExclusiveAccess(req.user, ['write:groups'], ['manage:groups', 'manage:system', 'manage:sites']) &&
        grp.permissions.some(p => {
          const resType = _.last(p.split(':'))
          return ['users', 'groups', 'navigation', 'theme', 'api', 'system'].includes(resType)
        })
      ) {
        throw new gql.GraphQLError('You are not authorized to assign a user to this elevated group.')
      }

      // Check for valid user
      const usr = await WIKI.models.users.query().findById(args.userId)
      if (!usr) {
        throw new gql.GraphQLError('Invalid User ID')
      }

      // Check for existing relation
      const relExist = await WIKI.models.knex('userGroups').where({
        userId: args.userId,
        groupId: args.groupId
      }).first()
      if (relExist) {
        throw new gql.GraphQLError('User is already assigned to group.')
      }

      // Assign user to group
      await grp.$relatedQuery('users').relate(usr.id)

      // Revoke tokens for this user
      WIKI.auth.revokeUserTokens({ id: usr.id, kind: 'u' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: usr.id, kind: 'u' })

      return {
        responseResult: graphHelper.generateSuccess('User has been assigned to group.')
      }
    },
    /**
     * CREATE NEW GROUP
     */
    async create (obj, args, { req }) {
      const canCreate = (user) => {
        for (const groupId of user.groups) {
          const group = _.get(WIKI.auth.groups, groupId, [])

          if (canManageSites(group)) {
            return true
          }
        }
        return false
      }

      if (!WIKI.auth.isSuperAdmin(req.user) && !canCreate(req.user)) {
        throw new gql.GraphQLError('Insufficient permissions to create groups.')
      }

      const permissions = WIKI.data.groups.defaultPermissions
      const rules = WIKI.data.groups.defaultPageRules

      if (!WIKI.auth.isSuperAdmin(req.user)) {
        rules[0].sites = groupsToSites(req.user.groups)
      }

      const group = await WIKI.models.groups.query().insertAndFetch({
        name: args.name,
        permissions: JSON.stringify(permissions),
        rules: JSON.stringify(rules),
        isSystem: false
      })

      if (!WIKI.auth.isSuperAdmin(req.user)) {
        await group.$relatedQuery('users').relate(req.user.id)

        // Revoke tokens for this user
        WIKI.auth.revokeUserTokens({ id: req.user.id, kind: 'u' })
        WIKI.events.outbound.emit('addAuthRevoke', { id: req.user.id, kind: 'u' })
      }

      await WIKI.auth.reloadGroups()
      WIKI.events.outbound.emit('reloadGroups')
      return {
        responseResult: graphHelper.generateSuccess('Group created successfully.'),
        group
      }
    },
    /**
     * DELETE GROUP
     */
    async delete (obj, args, { req }) {
      if (args.id === 1 || args.id === 2) {
        throw new gql.GraphQLError('Cannot delete this group.')
      }

      if (!canManageGroup(req.user, args.id)) {
        throw new gql.GraphQLError('Insufficient permissions to delete the group.')
      }

      await WIKI.models.groups.query().deleteById(args.id)

      WIKI.auth.revokeUserTokens({ id: args.id, kind: 'g' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'g' })

      await WIKI.auth.reloadGroups()
      WIKI.events.outbound.emit('reloadGroups')

      return {
        responseResult: graphHelper.generateSuccess('Group has been deleted.')
      }
    },
    /**
     * UNASSIGN USER FROM GROUP
     */
    async unassignUser (obj, args, { req }) {
      if (!canManageGroup(req.user, args.groupId)) {
        throw new gql.GraphQLError('Insufficient permissions to remove user from the group.')
      }

      if (args.userId === 2) {
        throw new gql.GraphQLError('Cannot unassign Guest user')
      }
      if (args.userId === 1 && args.groupId === 1) {
        throw new gql.GraphQLError('Cannot unassign Administrator user from Administrators group.')
      }
      const grp = await WIKI.models.groups.query().findById(args.groupId)
      if (!grp) {
        throw new gql.GraphQLError('Invalid Group ID')
      }
      const usr = await WIKI.models.users.query().findById(args.userId)
      if (!usr) {
        throw new gql.GraphQLError('Invalid User ID')
      }
      await grp.$relatedQuery('users').unrelate().where('userId', usr.id)

      WIKI.auth.revokeUserTokens({ id: usr.id, kind: 'u' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: usr.id, kind: 'u' })

      return {
        responseResult: graphHelper.generateSuccess('User has been unassigned from group.')
      }
    },
    /**
     * UPDATE GROUP
     */
    async update (obj, args, { req }) {
      if (WIKI.auth.checkExclusiveAccess(req.user, ['manage:sites'])) {
        for (const rule of args.rules) {
          for (const siteId of rule.sites) {
            if (!WIKI.auth.checkAccess(req.user, ['manage:sites'], {
              siteId: siteId,
              path: rule.path
            })) {
              throw new gql.GraphQLError('Insufficient permissions to update access to sites.')
            }
          }
        }
      }

      // Check for unsafe regex page rules
      if (_.some(args.rules, pr => {
        return pr.match === 'REGEX' && !safeRegex(pr.path)
      })) {
        throw new gql.GraphQLError('Some Page Rules contains unsafe or exponential time regex.')
      }

      // Set default redirect on login value
      if (_.isEmpty(args.redirectOnLogin)) {
        args.redirectOnLogin = '/'
      }

      // Check assigned permissions for write:groups
      if (
        WIKI.auth.checkExclusiveAccess(req.user, ['write:groups'], ['manage:groups', 'manage:system', 'manage:sites']) &&
        args.permissions.some(p => {
          const resType = _.last(p.split(':'))
          return ['users', 'groups', 'navigation', 'theme', 'api', 'system'].includes(resType)
        })
      ) {
        throw new gql.GraphQLError('You are not authorized to manage this group or assign these permissions.')
      }

      // Check assigned permissions for manage:groups
      if (
        WIKI.auth.checkExclusiveAccess(req.user, ['manage:groups'], ['manage:system', 'manage:sites']) &&
        args.permissions.some(p => _.last(p.split(':')) === 'system')
      ) {
        throw new gql.GraphQLError('You are not authorized to manage this group or assign the manage:system permissions.')
      }

      // Update group
      await WIKI.models.groups.query().patch({
        name: args.name,
        redirectOnLogin: args.redirectOnLogin,
        permissions: JSON.stringify(args.permissions),
        rules: JSON.stringify(args.rules)
      }).where('id', args.id)

      // Revoke tokens for this group
      WIKI.auth.revokeUserTokens({ id: args.id, kind: 'g' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'g' })

      // Reload group permissions
      await WIKI.auth.reloadGroups()
      WIKI.events.outbound.emit('reloadGroups')

      return {
        responseResult: graphHelper.generateSuccess('Group has been updated.')
      }
    }
  },
  Group: {
    users (grp) {
      return grp.$relatedQuery('users')
    }
  }
}
