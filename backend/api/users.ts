import { CustomError } from '../helpers/common.ts'
import type { FastifyInstance } from 'fastify'
import type { UserPatch } from '../models/users.ts'

interface UserUpdateBody {
  name?: string
  email?: string
  isActive?: boolean
  isVerified?: boolean
  meta?: Record<string, any>
  prefs?: Record<string, any>
  groups?: string[]
  auth?: Record<string, any>
}

/**
 * Users API Routes
 */
async function routes(app: FastifyInstance) {
  app.get<{
    Querystring: { page?: number; limit?: number; filter?: string; assignableToGroupId?: string }
  }>(
    '/',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'List all users',
        tags: ['Users'],
        querystring: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Matched against the user name and email, case-insensitively.',
              maxLength: 255
            },
            assignableToGroupId: {
              type: 'string',
              format: 'uuid',
              description:
                'Keep only the users that may be assigned to this group, i.e. omit its current members and any system user. Intended for pickers offering users to assign.'
            },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        },
        response: {
          200: {
            description: 'List of Users',
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
    async (req) => {
      const page = req.query.page ?? 1
      const limit = req.query.limit ?? 20
      const { total, users } = await WIKI.models.users.getUsers({
        filter: req.query.filter ?? '',
        assignableToGroupId: req.query.assignableToGroupId ?? '',
        page,
        limit
      })
      return { page, limit, total, users }
    }
  )

  app.get(
    '/whoami',
    {
      schema: {
        summary: 'Get currently logged in user info',
        tags: ['Users']
      }
    },
    async (req, reply) => {
      reply.preventCache()
      if (req.session?.authenticated) {
        return {
          authenticated: true,
          ...req.session.user,
          permissions: ['manage:system'] // TODO: pull actual permissions
        }
      } else {
        return {
          authenticated: false
        }
      }
    }
  )

  /**
   * GET USER DEFAULTS
   *
   * Instance-wide, not per-site: stored as the `userDefaults` key of the settings table.
   */
  app.get(
    '/defaults',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'Get the defaults applied to new users',
        tags: ['Users'],
        response: {
          200: {
            description: 'User defaults',
            type: 'object',
            $ref: 'UserDefaults#'
          }
        }
      }
    },
    async () => {
      return WIKI.config.userDefaults
    }
  )

  /**
   * UPDATE USER DEFAULTS
   */
  app.put<{ Body: { timezone?: string; dateFormat?: string; timeFormat?: string } }>(
    '/defaults',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Update the defaults applied to new users',
        description:
          'These are instance-wide, not per-site. Existing users keep their own preferences.',
        tags: ['Users'],
        body: {
          $ref: 'UserDefaults#'
        },
        response: {
          200: {
            description: 'User defaults updated successfully',
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
      // -> A bad time zone would break every date the affected users see, and the list of valid
      //    zones is only known at runtime, so it cannot be expressed as a schema enum
      if (req.body.timezone !== undefined) {
        if (!Intl.supportedValuesOf('timeZone').includes(req.body.timezone)) {
          throw new CustomError(
            'userDefaultsInvalidTimezone',
            `Not a recognized IANA time zone: ${req.body.timezone}`
          )
        }
      }

      const patch: Record<string, any> = {}
      for (const key of ['timezone', 'dateFormat', 'timeFormat'] as const) {
        if (req.body[key] !== undefined) {
          patch[key] = req.body[key]
        }
      }
      if (Object.keys(patch).length < 1) {
        throw new CustomError('userDefaultsEmpty', 'No user defaults provided to update.')
      }

      const previousDefaults = WIKI.config.userDefaults
      WIKI.config.userDefaults = { ...previousDefaults, ...patch }

      if (!(await WIKI.configSvc.saveToDb(['userDefaults']))) {
        WIKI.config.userDefaults = previousDefaults
        return reply.internalServerError('Failed to save user defaults.')
      }

      return {
        ok: true,
        message: 'User defaults updated successfully.'
      }
    }
  )

  app.get<{ Params: { userId: string } }>(
    '/:userId',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'Get user info',
        description:
          'Returns the user with its group membership and linked authentication providers.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        response: {
          200: {
            description: 'User info',
            type: 'object',
            $ref: 'User#'
          }
        }
      }
    },
    async (req, reply) => {
      const user = await WIKI.models.users.getUserDetail(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }
      return user
    }
  )

  /**
   * CREATE USER
   */
  app.post<{
    Body: {
      name: string
      email: string
      password: string
      groups?: string[]
      mustChangePassword?: boolean
      sendWelcomeEmail?: boolean
      sendWelcomeEmailFromSiteId?: string
    }
  }>(
    '/',
    {
      config: {
        permissions: ['create:users', 'manage:users']
      },
      schema: {
        summary: 'Create a new user',
        description:
          'Creates a user authenticated against the local strategy. `sendWelcomeEmail` is accepted but not yet supported, as the server has no mail transport.',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 255
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 255
            },
            groups: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid'
              }
            },
            mustChangePassword: {
              type: 'boolean',
              default: false
            },
            sendWelcomeEmail: {
              type: 'boolean',
              default: false
            },
            sendWelcomeEmailFromSiteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          examples: [
            {
              name: 'Jane Doe',
              email: 'jane@example.com',
              password: 'a-long-password',
              groups: []
            }
          ]
        },
        response: {
          200: {
            description: 'User created successfully',
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
        throw new CustomError('userCreateInvalidName', 'Invalid User Name')
      }
      if (await WIKI.models.users.getByEmail(req.body.email.toLowerCase())) {
        throw new CustomError('userCreateDuplicateEmail', 'A user with this email already exists.')
      }
      // -> There is no mail transport yet, so accepting this flag would silently drop the request
      if (req.body.sendWelcomeEmail) {
        throw new CustomError(
          'userCreateWelcomeEmailUnavailable',
          'Sending a welcome email is not supported yet, as mail delivery is not implemented.'
        )
      }

      try {
        const id = await WIKI.models.users.createUser({
          name: req.body.name,
          email: req.body.email,
          password: req.body.password,
          groups: req.body.groups ?? [],
          mustChangePassword: req.body.mustChangePassword ?? false
        })
        return {
          ok: true,
          message: 'User created successfully.',
          id
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * UPDATE USER
   */
  app.put<{ Params: { userId: string }; Body: UserUpdateBody }>(
    '/:userId',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Update a user',
        description:
          'Updates any subset of the user fields. Omitted fields are left unchanged. Passing `groups` replaces the group membership entirely — except for system users (the guest account), whose membership is fixed.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 255
            },
            isActive: {
              type: 'boolean'
            },
            isVerified: {
              type: 'boolean'
            },
            meta: {
              type: 'object',
              additionalProperties: true
            },
            prefs: {
              type: 'object',
              additionalProperties: true
            },
            groups: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid'
              }
            },
            auth: {
              type: 'object',
              description:
                'Local-strategy flags: `mustChangePwd`, `restrictLogin`, `tfaRequired`. Secrets cannot be set here — use the password endpoint.',
              properties: {
                mustChangePwd: {
                  type: 'boolean'
                },
                restrictLogin: {
                  type: 'boolean'
                },
                tfaRequired: {
                  type: 'boolean'
                }
              }
            }
          }
        },
        response: {
          200: {
            description: 'User updated successfully',
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
      const user = await WIKI.models.users.getById(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }

      // -> Collect only the fields actually provided
      const patch: UserPatch = {}
      for (const key of ['name', 'email', 'isActive', 'isVerified', 'meta', 'prefs'] as const) {
        if (req.body[key] !== undefined) {
          ;(patch as Record<string, any>)[key] = req.body[key]
        }
      }

      if (
        Object.keys(patch).length < 1 &&
        req.body.groups === undefined &&
        req.body.auth === undefined
      ) {
        throw new CustomError('userUpdateEmpty', 'No user fields provided to update.')
      }

      // -> Email is unique, so a clash needs a clearer answer than a constraint violation
      if (patch.email && patch.email.toLowerCase() !== user.email.toLowerCase()) {
        if (await WIKI.models.users.getByEmail(patch.email.toLowerCase())) {
          throw new CustomError(
            'userUpdateDuplicateEmail',
            'A user with this email already exists.'
          )
        }
      }

      // -> Group membership is replaced wholesale here, which would otherwise be a way around the
      //    guards on the groups endpoint.
      if (req.body.groups !== undefined) {
        // -> The guest account must stay in the guests group and nowhere else. Resending the
        //    membership unchanged is allowed, so that saving another field is not blocked.
        if (user.isSystem) {
          const current = await WIKI.models.users.getUserGroupIds(req.params.userId)
          const requested = req.body.groups
          const unchanged =
            current.length === requested.length && current.every((id) => requested.includes(id))
          if (!unchanged) {
            return reply.conflict('Cannot change the group membership of a system user.')
          }
        }

        const rootAdminGroupId = WIKI.config.auth.rootAdminGroupId
        const wasRootAdmin = await WIKI.models.groups.isUserInGroup(
          rootAdminGroupId,
          req.params.userId
        )
        if (wasRootAdmin && !req.body.groups.includes(rootAdminGroupId)) {
          if ((await WIKI.models.groups.countUsersInGroup(rootAdminGroupId)) <= 1) {
            return reply.conflict('Cannot remove the last user from the root administrators group.')
          }
        }
      }

      try {
        if (Object.keys(patch).length > 0) {
          await WIKI.models.users.updateUser(req.params.userId, patch)
        }
        if (req.body.groups !== undefined) {
          await WIKI.models.users.setUserGroups(req.params.userId, req.body.groups)
        }
        if (req.body.auth !== undefined) {
          await WIKI.models.users.setUserAuthFlags(req.params.userId, req.body.auth)
        }
        return {
          ok: true,
          message: 'User updated successfully.'
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * SET USER PASSWORD
   */
  app.put<{
    Params: { userId: string }
    Body: { newPassword: string; mustChangePassword?: boolean }
  }>(
    '/:userId/password',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: "Set a user's password",
        description: 'Replaces the local-strategy password. Other linked providers are untouched.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        body: {
          type: 'object',
          required: ['newPassword'],
          properties: {
            newPassword: {
              type: 'string',
              minLength: 8,
              maxLength: 255
            },
            mustChangePassword: {
              type: 'boolean',
              default: false
            }
          }
        },
        response: {
          200: {
            description: 'Password updated successfully',
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
      const updated = await WIKI.models.users.setUserPassword({
        id: req.params.userId,
        newPassword: req.body.newPassword,
        mustChangePassword: req.body.mustChangePassword ?? false
      })
      if (!updated) {
        return reply.notFound('User does not exist.')
      }
      return {
        ok: true,
        message: 'User password updated successfully.'
      }
    }
  )

  app.delete<{ Params: { userId: string } }>(
    '/:userId',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Delete a user',
        description:
          'System users cannot be deleted, nor can the last user of the root administrators group.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        response: {
          204: {
            description: 'User deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const user = await WIKI.models.users.getById(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }
      if (user.isSystem) {
        return reply.conflict('Cannot delete a system user.')
      }

      // -> Emptying the root administrators group would lock everyone out of system management
      const rootAdminGroupId = WIKI.config.auth.rootAdminGroupId
      if (await WIKI.models.groups.isUserInGroup(rootAdminGroupId, user.id)) {
        if ((await WIKI.models.groups.countUsersInGroup(rootAdminGroupId)) <= 1) {
          return reply.conflict('Cannot delete the last user of the root administrators group.')
        }
      }

      try {
        await WIKI.models.users.deleteUser(user.id)
        return reply.code(204).send()
      } catch (err: any) {
        // -> Pages and assets reference users without a cascade, so a user who authored content
        //    cannot be removed. That is a conflict to report, not a server fault.
        if (err.cause?.code === '23503' || err.code === '23503') {
          return reply.conflict(
            'Cannot delete a user who still owns pages or assets. Reassign them first.'
          )
        }
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )
}

export default routes
