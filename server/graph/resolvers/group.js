const graphHelper = require('../../helpers/graph')
const safeRegex = require('safe-regex')
const _ = require('lodash')
const { handleUserSiteInactivityAfterUnassign } = require('../services/userSiteInactivityService')

const {
  getManagedSiteIdsFromGroups,
  canManageGroup,
  canManageSites,
  DEFAULT_ADMINISTRATORS_GROUP,
  DEFAULT_GUESTS_GROUP
} = require('../../helpers/group')

/* global WIKI */

const GROUP_NAME_EXISTS_ERROR = 'A group with this name already exists.'

const isSystemAdminPermission = (permissions) => {
  return permissions.some(p => {
    const resType = _.last(p.split(':'))
    return ['users', 'groups', 'navigation', 'theme', 'api', 'system'].includes(resType)
  })
}

module.exports = {
  Query: {
    /**
     * FETCH ALL GROUPS
     */
    async listGroups(obj, args, { req }) {
      const groups = await WIKI.models.groups
        .query()
        .select(
          'groups.*',
          WIKI.models.groups.relatedQuery('users').count().as('userCount')
        )

      if (WIKI.auth.isSuperAdmin(req.user)) {
        return groups
      }

      const filteredGroups = _.filter(groups, (g) =>
        canManageGroup(req.user, g.id)
      )

      return filteredGroups
    },
    /**
     * FETCH A SINGLE GROUP
     */
    async groupById(obj, args, { req }) {
      const fetchGroupById = (id) => WIKI.models.groups.query().findById(id)

      if (WIKI.auth.isSuperAdmin(req.user)) {
        return fetchGroupById(args.id)
      }

      if (canManageGroup(req.user, args.id)) {
        return fetchGroupById(args.id)
      }

      throw graphHelper.forbidden(
        'Insufficient permissions to list the group properties.'
      )
    }
  },
  Mutation: {
    async groups() {
      return {}
    }
  },
  GroupMutation: {
    /**
     * ASSIGN USER TO GROUP
     */
    async assignUser(obj, args, { req }) {
      // Check for valid group
      const grp = await WIKI.models.groups.query().findById(args.groupId)
      if (!grp) {
        throw graphHelper.badRequest('Invalid Group ID')
      }

      if (!canManageGroup(req.user, args.groupId)) {
        throw graphHelper.forbidden(
          'Insufficient permissions to assign user to the group.'
        )
      }

      // Check for guest user
      if (args.userId === 2) {
        throw graphHelper.forbidden('Cannot assign the Guest user to a group.')
      }

      // Check assigned permissions for write:groups
      if (
        WIKI.auth.checkExclusiveAccess(
          req.user,
          ['write:groups'],
          ['manage:groups', 'manage:system', 'manage:sites']
        ) &&
        isSystemAdminPermission(grp.permissions)
      ) {
        throw graphHelper.forbidden(
          'You are not authorized to assign a user to this elevated group.'
        )
      }

      // Check for valid user
      const usr = await WIKI.models.users.query().findById(args.userId)
      if (!usr) {
        throw graphHelper.badRequest('Invalid User ID')
      }

      // Check for existing relation
      const relExist = await WIKI.models
        .knex('userGroups')
        .where({
          userId: args.userId,
          groupId: args.groupId
        })
        .first()
      if (relExist) {
        throw graphHelper.badRequest('User is already assigned to group.')
      }

      // Assign user to group
      await grp.$relatedQuery('users').relate(usr.id)

      // Revoke tokens for this user
      WIKI.auth.revokeUserTokens({ id: usr.id, kind: 'u' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: usr.id, kind: 'u' })

      return {
        responseResult: graphHelper.generateSuccess(
          'User has been assigned to group.'
        )
      }
    },
    /**
     * CREATE NEW GROUP
     */
    async create(obj, args, { req }) {
      const existingGroup = await WIKI.models.groups.query().findOne({ name: args.name })
      if (existingGroup) {
        throw graphHelper.badRequest(GROUP_NAME_EXISTS_ERROR)
      }

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
        throw graphHelper.forbidden(
          'Insufficient permissions to create groups.'
        )
      }

      const permissions = WIKI.data.groups.defaultPermissions
      const rules = WIKI.data.groups.defaultPageRules

      if (!WIKI.auth.isSuperAdmin(req.user)) {
        rules[0].sites = getManagedSiteIdsFromGroups(req.user.groups)
      } else {
        rules[0].sites = [
          await WIKI.models.sites.getSiteIdByPath({
            path: 'default',
            forceReload: true
          })
        ]
      }

      const group = await WIKI.models.groups.query().insertAndFetch({
        name: args.name,
        permissions: JSON.stringify(permissions),
        rules: JSON.stringify(rules),
        isSystem: false
      })

      await WIKI.auth.reloadGroups()
      WIKI.events.outbound.emit('reloadGroups')
      return {
        responseResult: graphHelper.generateSuccess(
          'Group created successfully.'
        ),
        group
      }
    },
    /**
     * DELETE GROUP
     */
    async delete(obj, args, { req }) {
      if (
        args.id === DEFAULT_ADMINISTRATORS_GROUP ||
        args.id === DEFAULT_GUESTS_GROUP
      ) {
        throw graphHelper.forbidden('Cannot delete this group.')
      }

      if (!canManageGroup(req.user, args.id)) {
        throw graphHelper.forbidden(
          'Insufficient permissions to delete the group.'
        )
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
    async unassignUser(obj, args, { req }) {
      const grp = await WIKI.models.groups.query().findById(args.groupId)
      if (!grp) {
        throw graphHelper.badRequest('Invalid Group ID')
      }

      if (!canManageGroup(req.user, args.groupId)) {
        throw graphHelper.forbidden(
          'Insufficient permissions to remove user from the group.'
        )
      }

      if (args.userId === 2) {
        throw graphHelper.forbidden('Cannot unassign Guest user')
      }
      if (args.userId === 1 && args.groupId === DEFAULT_ADMINISTRATORS_GROUP) {
        throw graphHelper.forbidden(
          'Cannot unassign Administrator user from Administrators group.'
        )
      }

      const usr = await WIKI.models.users.query().findById(args.userId)
      if (!usr) {
        throw graphHelper.badRequest('Invalid User ID')
      }
      await grp.$relatedQuery('users').unrelate().where('userId', usr.id)

      // Handle user inactivity after unassign
      await handleUserSiteInactivityAfterUnassign(grp, usr)

      WIKI.auth.revokeUserTokens({ id: usr.id, kind: 'u' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: usr.id, kind: 'u' })

      return {
        responseResult: graphHelper.generateSuccess(
          'User has been unassigned from group.'
        )
      }
    },
    /**
     * UPDATE GROUP
     */
    async update(obj, args, { req }) {
      const existingGroup = await WIKI.models.groups.query().findOne({ name: args.name })
      if (existingGroup && existingGroup.id !== args.id) {
        throw graphHelper.badRequest(GROUP_NAME_EXISTS_ERROR)
      }

      // Check for unsafe regex page rules
      if (
        _.some(args.rules, (pr) => {
          return pr.match === 'REGEX' && !safeRegex(pr.path)
        })
      ) {
        throw graphHelper.badRequest(
          'Some Page Rules contains unsafe or exponential time regex.'
        )
      }

      if (canManageGroup(req.user, args.id)) {
        for (const rule of args.rules) {
          for (const siteId of rule.sites) {
            if (
              !WIKI.auth.checkAccess(req.user, ['manage:sites'], {
                siteId: siteId,
                path: rule.path
              })
            ) {
              throw graphHelper.forbidden(
                'Insufficient permissions to update access to sites.'
              )
            }
          }
        }
      } else {
        throw graphHelper.forbidden(
          'Insufficient permissions to update the group.'
        )
      }

      // Set default redirect on login value
      if (_.isEmpty(args.redirectOnLogin)) {
        args.redirectOnLogin = '/'
      }

      if (
        !WIKI.auth.isSuperAdmin(req.user) &&
        isSystemAdminPermission(args.permissions)
      ) {
        throw graphHelper.forbidden(
          'You are not authorized to assign the system permissions.'
        )
      }

      // Check assigned permissions for write:groups
      if (
        WIKI.auth.checkExclusiveAccess(
          req.user,
          ['write:groups'],
          ['manage:groups', 'manage:system', 'manage:sites']
        ) &&
        isSystemAdminPermission(args.permissions)
      ) {
        throw graphHelper.forbidden(
          'You are not authorized to manage this group or assign these permissions.'
        )
      }

      // Check assigned permissions for manage:groups
      if (
        WIKI.auth.checkExclusiveAccess(
          req.user,
          ['manage:groups'],
          ['manage:system', 'manage:sites']
        ) &&
        args.permissions.some((p) => _.last(p.split(':')) === 'system')
      ) {
        throw graphHelper.forbidden(
          'You are not authorized to manage this group or assign the manage:system permissions.'
        )
      }

      // Update group
      await WIKI.models.groups
        .query()
        .patch({
          name: args.name,
          redirectOnLogin: args.redirectOnLogin,
          permissions: JSON.stringify(args.permissions),
          rules: JSON.stringify(args.rules)
        })
        .where('id', args.id)

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
    users(grp) {
      return grp.$relatedQuery('users')
    }
  }
}
