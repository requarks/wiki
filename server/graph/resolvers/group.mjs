import { generateSuccess } from '../../helpers/graph.mjs'
import safeRegex from 'safe-regex'
import _ from 'lodash-es'
import { v4 as uuid } from 'uuid'

export default {
  Query: {
    /**
     * FETCH ALL GROUPS
     */
    async groups (obj, args, context) {
      if (!WIKI.auth.checkAccess(context.req.user, ['manage:groups', 'manage:users', 'manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }
      return WIKI.db.groups.query().select(
        'groups.*',
        WIKI.db.groups.relatedQuery('users').count().as('userCount')
      )
    },
    /**
     * FETCH A SINGLE GROUP
     */
    async groupById(obj, args, context) {
      if (!WIKI.auth.checkAccess(context.req.user, ['manage:groups', 'manage:users', 'manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }
      return WIKI.db.groups.query().findById(args.id)
    }
  },
  Mutation: {
    /**
     * ASSIGN USER TO GROUP
     */
    async assignUserToGroup (obj, args, { req }) {
      if (!WIKI.auth.checkAccess(req.user, ['manage:groups', 'manage:users', 'manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }

      // Check for guest user
      if (args.userId === WIKI.config.auth.guestUserId) {
        throw new Error('Cannot assign the Guest user to a group.')
      }

      // Check for valid group
      const grp = await WIKI.db.groups.query().findById(args.groupId)
      if (!grp) {
        throw new Error('Invalid Group ID')
      }

      // Check assigned permissions for write:groups
      if (
        WIKI.auth.checkExclusiveAccess(req.user, ['write:groups'], ['manage:groups', 'manage:system']) &&
        grp.permissions.some(p => {
          const resType = _.last(p.split(':'))
          return ['users', 'groups', 'navigation', 'theme', 'api', 'system'].includes(resType)
        })
      ) {
        throw new Error('You are not authorized to assign a user to this elevated group.')
      }

      // Check for valid user
      const usr = await WIKI.db.users.query().findById(args.userId)
      if (!usr) {
        throw new Error('Invalid User ID')
      }

      // Check for existing relation
      const relExist = await WIKI.db.knex('userGroups').where({
        userId: args.userId,
        groupId: args.groupId
      }).first()
      if (relExist) {
        throw new Error('User is already assigned to group.')
      }

      // Assign user to group
      await grp.$relatedQuery('users').relate(usr.id)

      // Revoke tokens for this user
      WIKI.auth.revokeUserTokens({ id: usr.id, kind: 'u' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: usr.id, kind: 'u' })

      return {
        operation: generateSuccess('User has been assigned to group.')
      }
    },
    /**
     * CREATE NEW GROUP
     */
    async createGroup (obj, args, { req }) {
      if (!WIKI.auth.checkAccess(req.user, ['manage:groups', 'manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }

      const group = await WIKI.db.groups.query().insertAndFetch({
        name: args.name,
        permissions: JSON.stringify(WIKI.data.groups.defaultPermissions),
        rules: JSON.stringify(WIKI.data.groups.defaultRules.map(r => ({
          id: uuid(),
          ...r
        }))),
        isSystem: false
      })
      await WIKI.auth.reloadGroups()
      WIKI.events.outbound.emit('reloadGroups')
      return {
        operation: generateSuccess('Group created successfully.'),
        group
      }
    },
    /**
     * DELETE GROUP
     */
    async deleteGroup (obj, args, { req }) {
      if (!WIKI.auth.checkAccess(req.user, ['manage:groups', 'manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }

      if (args.id === WIKI.data.systemIds.guestsGroupId || args.id === WIKI.data.systemIds.usersGroupId || args.id === WIKI.config.auth.rootAdminGroupId) {
        throw new Error('Cannot delete this group.')
      }

      await WIKI.db.groups.query().deleteById(args.id)

      WIKI.auth.revokeUserTokens({ id: args.id, kind: 'g' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'g' })

      await WIKI.auth.reloadGroups()
      WIKI.events.outbound.emit('reloadGroups')

      return {
        operation: generateSuccess('Group has been deleted.')
      }
    },
    /**
     * UNASSIGN USER FROM GROUP
     */
    async unassignUserFromGroup (obj, args, { req }) {
      if (!WIKI.auth.checkAccess(req.user, ['manage:groups', 'manage:users', 'manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }

      if (args.userId === 2) {
        throw new Error('Cannot unassign Guest user')
      }
      if (args.userId === WIKI.config.auth.guestUserId && args.groupId === WIKI.data.systemIds.guestsGroupId) {
        throw new Error('Cannot unassign Administrator user from Administrators group.')
      }
      const grp = await WIKI.db.groups.query().findById(args.groupId)
      if (!grp) {
        throw new Error('Invalid Group ID')
      }
      const usr = await WIKI.db.users.query().findById(args.userId)
      if (!usr) {
        throw new Error('Invalid User ID')
      }
      await grp.$relatedQuery('users').unrelate().where('userId', usr.id)

      WIKI.auth.revokeUserTokens({ id: usr.id, kind: 'u' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: usr.id, kind: 'u' })

      return {
        operation: generateSuccess('User has been unassigned from group.')
      }
    },
    /**
     * UPDATE GROUP
     */
    async updateGroup (obj, args, { req }) {
      if (!WIKI.auth.checkAccess(req.user, ['manage:groups', 'manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }

      // Check for unsafe regex page rules
      if (_.some(args.pageRules, pr => {
        return pr.match === 'REGEX' && !safeRegex(pr.path)
      })) {
        throw new Error('Some Page Rules contains unsafe or exponential time regex.')
      }

      // Set default redirect on login value
      if (_.isEmpty(args.redirectOnLogin)) {
        args.redirectOnLogin = '/'
      }

      // Check assigned permissions for write:groups
      if (
        WIKI.auth.checkExclusiveAccess(req.user, ['write:groups'], ['manage:groups', 'manage:system']) &&
        args.permissions.some(p => {
          const resType = _.last(p.split(':'))
          return ['users', 'groups', 'navigation', 'theme', 'api', 'system'].includes(resType)
        })
      ) {
        throw new Error('You are not authorized to manage this group or assign these permissions.')
      }

      // Check assigned permissions for manage:groups
      if (
        WIKI.auth.checkExclusiveAccess(req.user, ['manage:groups'], ['manage:system']) &&
        args.permissions.some(p => _.last(p.split(':')) === 'system')
      ) {
        throw new Error('You are not authorized to manage this group or assign the manage:system permissions.')
      }

      // Update group
      await WIKI.db.groups.query().patch({
        name: args.name,
        redirectOnLogin: args.redirectOnLogin,
        permissions: JSON.stringify(args.permissions),
        pageRules: JSON.stringify(args.pageRules)
      }).where('id', args.id)

      // Revoke tokens for this group
      WIKI.auth.revokeUserTokens({ id: args.id, kind: 'g' })
      WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'g' })

      // Reload group permissions
      await WIKI.auth.reloadGroups()
      WIKI.events.outbound.emit('reloadGroups')

      return {
        operation: generateSuccess('Group has been updated.')
      }
    }
  },
  Group: {
    users (grp) {
      return grp.$relatedQuery('users')
    }
  }
}
