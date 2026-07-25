import { CustomError } from '../helpers/common.ts'
import type { FastifyInstance } from 'fastify'
import type { GroupPatch, GroupRule } from '../models/groups.ts'

interface GroupUpdateBody {
  name?: string
  redirectOnLogin?: string
  redirectOnFirstLogin?: string
  redirectOnLogout?: string
  permissions?: string[]
  rules?: GroupRule[]
}

/**
 * Groups API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST ALL GROUPS
   */
  app.get(
    '/',
    {
      config: {
        permissions: ['read:groups', 'manage:groups']
      },
      schema: {
        summary: 'List all groups',
        tags: ['Groups'],
        response: {
          200: {
            description: 'List of all groups',
            type: 'array',
            items: { $ref: 'GroupCore#' }
          }
        }
      }
    },
    async () => {
      return WIKI.models.groups.getAllGroups()
    }
  )

  /**
   * CREATE GROUP
   */
  app.post<{ Body: { name: string } }>(
    '/',
    {
      config: {
        permissions: ['write:groups', 'manage:groups']
      },
      schema: {
        summary: 'Create a new group',
        description:
          'Creates a non-system group, seeded with the same starting permissions and default rule as the built-in `Users` group.',
        tags: ['Groups'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            }
          },
          examples: [{ name: 'Editors' }]
        },
        response: {
          200: {
            description: 'Group created successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              id: {
                type: 'string',
                format: 'uuid'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!/^[^<>"]+$/.test(req.body.name)) {
        throw new CustomError('groupCreateInvalidName', 'Invalid Group Name')
      }

      try {
        const id = await WIKI.models.groups.createGroup(req.body.name)
        return {
          ok: true,
          message: 'Group created successfully.',
          id
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * GET SINGLE GROUP
   */
  app.get<{ Params: { groupId: string } }>(
    '/:groupId',
    {
      config: {
        permissions: ['read:groups', 'manage:groups']
      },
      schema: {
        summary: 'Get a single group',
        description: 'Returns the group with its full permissions and page rules.',
        tags: ['Groups'],
        params: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['groupId']
        },
        response: {
          200: {
            description: 'Group info',
            type: 'object',
            $ref: 'Group#'
          }
        }
      }
    },
    async (req, reply) => {
      const group = await WIKI.models.groups.getGroupById(req.params.groupId)
      if (!group) {
        return reply.notFound('Group does not exist.')
      }
      return group
    }
  )

  /**
   * UPDATE GROUP
   */
  app.put<{ Params: { groupId: string }; Body: GroupUpdateBody }>(
    '/:groupId',
    {
      config: {
        permissions: ['write:groups', 'manage:groups']
      },
      schema: {
        summary: 'Update a group',
        description:
          'Updates any subset of the group fields. Omitted fields are left unchanged. The permissions of the root administrators group cannot be modified.',
        tags: ['Groups'],
        params: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['groupId']
        },
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            },
            redirectOnLogin: {
              type: 'string',
              maxLength: 255
            },
            redirectOnFirstLogin: {
              type: 'string',
              maxLength: 255
            },
            redirectOnLogout: {
              type: 'string',
              maxLength: 255
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            rules: {
              type: 'array',
              items: { $ref: 'GroupRule#' }
            }
          },
          examples: [
            {
              name: 'Editors',
              permissions: ['read:pages', 'write:pages']
            }
          ]
        },
        response: {
          200: {
            description: 'Group updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const group = await WIKI.models.groups.getGroupById(req.params.groupId)
      if (!group) {
        return reply.notFound('Group does not exist.')
      }

      // -> Collect only the fields actually provided
      const patch: GroupPatch = {}
      if (req.body.name !== undefined) {
        patch.name = req.body.name
      }
      if (req.body.redirectOnLogin !== undefined) {
        patch.redirectOnLogin = req.body.redirectOnLogin
      }
      if (req.body.redirectOnFirstLogin !== undefined) {
        patch.redirectOnFirstLogin = req.body.redirectOnFirstLogin
      }
      if (req.body.redirectOnLogout !== undefined) {
        patch.redirectOnLogout = req.body.redirectOnLogout
      }
      if (req.body.permissions !== undefined) {
        patch.permissions = req.body.permissions
      }
      if (req.body.rules !== undefined) {
        patch.rules = req.body.rules
      }

      if (Object.keys(patch).length < 1) {
        throw new CustomError('groupUpdateEmpty', 'No group fields provided to update.')
      }

      // -> The root administrators group must keep its permissions, or the instance becomes
      //    unmanageable with no way to grant `manage:system` back. Resending the current set is
      //    allowed, so that a client editing other fields can still submit the whole group.
      if (patch.permissions && group.id === WIKI.config.auth.rootAdminGroupId) {
        const isUnchanged =
          patch.permissions.length === group.permissions.length &&
          patch.permissions.every((p) => group.permissions.includes(p))
        if (!isUnchanged) {
          throw new CustomError(
            'groupUpdateRootAdminPermissions',
            'Cannot modify the permissions of the root administrators group.'
          )
        }
      }

      // -> Rule IDs must be unique within the group, as they address the rule client-side
      if (patch.rules) {
        const ruleIds = patch.rules.map((r) => r.id)
        if (new Set(ruleIds).size !== ruleIds.length) {
          throw new CustomError('groupUpdateDuplicateRuleId', 'Group rule IDs must be unique.')
        }
      }

      try {
        await WIKI.models.groups.updateGroup(group.id, patch)
        return {
          ok: true,
          message: 'Group updated successfully.'
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * DELETE GROUP
   */
  app.delete<{ Params: { groupId: string } }>(
    '/:groupId',
    {
      config: {
        permissions: ['manage:groups']
      },
      schema: {
        summary: 'Delete a group',
        description:
          'Deletes the group and removes all of its user assignments. System groups cannot be deleted.',
        tags: ['Groups'],
        params: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['groupId']
        },
        response: {
          204: {
            description: 'Group deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const group = await WIKI.models.groups.getGroupById(req.params.groupId)
      if (!group) {
        return reply.notFound('Group does not exist.')
      }
      if (group.isSystem) {
        return reply.conflict('Cannot delete a system group.')
      }

      try {
        await WIKI.models.groups.deleteGroup(group.id)
        return reply.code(204).send()
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * LIST GROUP USERS
   */
  app.get<{
    Params: { groupId: string }
    Querystring: { filter?: string; page?: number; limit?: number }
  }>(
    '/:groupId/users',
    {
      config: {
        permissions: ['read:groups', 'manage:groups']
      },
      schema: {
        summary: 'List the users assigned to a group',
        description: 'Returns a page of group members, ordered by name.',
        tags: ['Groups'],
        params: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['groupId']
        },
        querystring: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Case-insensitive substring matched against the name and email.',
              maxLength: 255
            },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        },
        response: {
          200: {
            description: 'List of group members',
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              users: {
                type: 'array',
                items: { $ref: 'UserCore#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const group = await WIKI.models.groups.getGroupById(req.params.groupId)
      if (!group) {
        return reply.notFound('Group does not exist.')
      }

      const page = req.query.page ?? 1
      const limit = req.query.limit ?? 20
      const { total, users } = await WIKI.models.groups.getGroupUsers(group.id, {
        filter: req.query.filter,
        page,
        limit
      })

      return { page, limit, total, users }
    }
  )

  /**
   * ASSIGN USER TO GROUP
   */
  app.post<{ Params: { groupId: string; userId: string } }>(
    '/:groupId/users/:userId',
    {
      config: {
        permissions: ['write:groups', 'manage:groups']
      },
      schema: {
        summary: 'Assign a user to a group',
        description:
          'System users (the guest account) cannot be assigned: their group membership is fixed at install time.',
        tags: ['Groups'],
        params: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['groupId', 'userId']
        },
        response: {
          200: {
            description: 'User assigned successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const group = await WIKI.models.groups.getGroupById(req.params.groupId)
      if (!group) {
        return reply.notFound('Group does not exist.')
      }
      const user = await WIKI.models.users.getById(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }
      // -> The guest account is the only system user, and it must stay in the guests group alone:
      //    its permissions are what anonymous visitors get.
      if (user.isSystem) {
        return reply.conflict('Cannot assign a system user to a group.')
      }

      const assigned = await WIKI.models.groups.assignUserToGroup(group.id, req.params.userId)
      if (!assigned) {
        return reply.conflict('User is already assigned to this group.')
      }

      return {
        ok: true,
        message: 'User assigned to group successfully.'
      }
    }
  )

  /**
   * UNASSIGN USER FROM GROUP
   */
  app.delete<{ Params: { groupId: string; userId: string } }>(
    '/:groupId/users/:userId',
    {
      config: {
        permissions: ['write:groups', 'manage:groups']
      },
      schema: {
        summary: 'Unassign a user from a group',
        description:
          'Removes the user from the group. The last remaining user cannot be removed from the root administrators group, and system users (the guest account) cannot be unassigned at all.',
        tags: ['Groups'],
        params: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['groupId', 'userId']
        },
        response: {
          204: {
            description: 'User unassigned successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const group = await WIKI.models.groups.getGroupById(req.params.groupId)
      if (!group) {
        return reply.notFound('Group does not exist.')
      }
      if (!(await WIKI.models.groups.isUserInGroup(group.id, req.params.userId))) {
        return reply.notFound('User is not assigned to this group.')
      }

      // -> Removing the guest account from the guests group would strip anonymous visitors of the
      //    permissions that group carries, with no way to put it back
      const user = await WIKI.models.users.getById(req.params.userId)
      if (user?.isSystem) {
        return reply.conflict('Cannot unassign a system user from a group.')
      }

      // -> Emptying the root administrators group would lock everyone out of system management
      if (group.id === WIKI.config.auth.rootAdminGroupId) {
        if ((await WIKI.models.groups.countUsersInGroup(group.id)) <= 1) {
          return reply.conflict('Cannot remove the last user from the root administrators group.')
        }
      }

      await WIKI.models.groups.unassignUserFromGroup(group.id, req.params.userId)
      return reply.code(204).send()
    }
  )
}

export default routes
