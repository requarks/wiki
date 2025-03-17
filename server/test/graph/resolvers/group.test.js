const WIKI = {
  auth: {
    isSuperAdmin: jest.fn(),
    isSiteAdmin: jest.fn(),
    checkExclusiveAccess: jest.fn(),
    checkAccess: jest.fn(),
    revokeUserTokens: jest.fn(),
    reloadGroups: jest.fn(),
    groups: {
      '1': {
        id: 1,
        name: 'Administrators',
        permissions: ['manage:system'],
        rules: [],
        isSystem: true,
        createdAt: '2024-09-24T18:32:11.291Z',
        updatedAt: '2024-09-24T18:32:11.291Z',
        redirectOnLogin: '/'
      },
      '2': {
        id: 2,
        name: 'Guests',
        permissions: ['read:pages', 'read:assets', 'read:comments'],
        rules: [
          {
            id: 'guest',
            deny: false,
            match: 'START',
            roles: ['read:pages', 'read:assets', 'read:comments'],
            path: '',
            locales: [],
            sites: ['b722970a-e813-4b6a-8563-87ffc77827e5']
          },
          {
            id: '222813d816',
            deny: false,
            match: 'START',
            roles: ['read:pages', 'read:assets', 'read:comments'],
            path: '',
            locales: [],
            sites: [
              'bdc620e1-e7ed-4335-bf09-fc897bf43f5b',
              'd013a996-cb0e-4fc4-954a-fc89e94dfd49'
            ]
          }
        ],
        isSystem: true,
        createdAt: '2024-09-24T18:32:11.293Z',
        updatedAt: '2024-12-05T18:47:39.465Z',
        redirectOnLogin: '/'
      },
      '3': {
        id: 3,
        name: 'Regular Users',
        permissions: [
          'read:pages',
          'read:assets',
          'read:comments',
          'write:comments'
        ],
        rules: [
          {
            id: 'default',
            deny: false,
            match: 'START',
            roles: [
              'read:pages',
              'read:assets',
              'read:comments',
              'write:comments',
              'write:pages',
              'manage:pages'
            ],
            path: '',
            locales: [],
            sites: [
              'SITE-1',
              'SITE-2',
              'SITE-3',
              'SITE-4'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-09-25T15:10:16.326Z',
        updatedAt: '2024-12-05T18:48:32.442Z',
        redirectOnLogin: '/'
      },
      '4': {
        id: 4,
        name: 'Site Admin',
        permissions: [
          'read:pages',
          'read:assets',
          'read:comments',
          'write:comments',
          'manage:sites'
        ],
        rules: [
          {
            id: 'default',
            deny: false,
            match: 'START',
            roles: ['manage:sites'],
            path: '',
            locales: [],
            sites: [
              'SITE-4'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      }
    }
  },
  models: {
    groups: {
      query: jest.fn()
    }
  },
  events: {
    outbound: {
      emit: jest.fn()
    }
  },
  users: {
    query: jest.fn(() => ({
      findById: jest.fn().mockResolvedValue({ id: 5 })
    }))
  },
  knex: jest.fn(() => ({
    where: jest.fn(() => ({ first: jest.fn().mockResolvedValue(null) }))
  }))
}

const groupResolvers = require('../../../graph/resolvers/group')

describe('Group Resolvers', () => {
  let req

  beforeEach(() => {
    req = {
      user: {
        groups: [3, 4]
      }
    }

    WIKI.auth.isSuperAdmin.mockReturnValue(false)
    WIKI.auth.isSiteAdmin.mockReturnValue(true)
    WIKI.auth.checkExclusiveAccess.mockReturnValue(false)
    WIKI.auth.checkAccess.mockReturnValue(true)
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GroupMutation', () => {
    describe('update', () => {
      it('should update group details', async () => {
        WIKI.models.groups.query.mockReturnValue({
          patch: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(1)
          })
        })

        const result = await groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-4'] }] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
        expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 4, kind: 'g' })
        expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: 4, kind: 'g' })
      })

      it('should throw error for unsafe regex in page rules', async () => {
        await expect(groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: [], rules: [{ match: 'REGEX', path: '(a+){10}' }] }, { req }))
          .rejects
          .toThrow('Some Page Rules contains unsafe or exponential time regex.')
      })

      it('should throw error if non-super admin tries to assign system permissions', async () => {
        await expect(groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: ['manage:system'], rules: [] }, { req }))
          .rejects
          .toThrow('You are not authorized to assign the system permissions.')
      })

      it('should throw error if non-super admin tries to assign multiple system permissions', async () => {
        await expect(groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: ['manage:system', 'manage:api'], rules: [] }, { req }))
          .rejects
          .toThrow('You are not authorized to assign the system permissions.')
      })

      it('should throw error if non-super admin tries to assign mixed permissions including system permissions', async () => {
        await expect(groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: ['manage:system', 'read:pages'], rules: [] }, { req }))
          .rejects
          .toThrow('You are not authorized to assign the system permissions.')
      })

      it('should not throw error if non-super admin assigns non-system permissions', async () => {
        WIKI.models.groups.query.mockReturnValue({
          patch: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(4)
          })
        })

        const result = await groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: ['read:pages'], rules: [] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
        expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 4, kind: 'g' })
        expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: 4, kind: 'g' })
      })

      it('should throw error if user tries to update group with invalid site access', async () => {
        WIKI.auth.checkAccess.mockReturnValue(false)

        await expect(groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-1'], path: '/' }] }, { req }))
          .rejects
          .toThrow('Insufficient permissions to update access to sites.')
      })

      it('should update group with valid site access', async () => {
        WIKI.models.groups.query.mockReturnValue({
          patch: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(4)
          })
        })

        const result = await groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-4'], path: '/' }] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
      })

      it('should throw error if user tries to update a non managed group', async () => {
        await expect(groupResolvers.GroupMutation.update(null, { id: 3, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-1'], path: '/' }] }, { req }))
          .rejects
          .toThrow('Insufficient permissions to update the group.')
      })
    })

    describe('Function assignUser', () => {
      let req
      const { assignUser } = groupResolvers.GroupMutation

      beforeEach(() => {
        req = {
          user: {
            id: 1,
            groups: [3, 4],
            permissions: ['manage:sites']
          }
        }

        WIKI.auth.isSuperAdmin.mockReturnValue(false)
        WIKI.auth.isSiteAdmin.mockReturnValue(true)
        WIKI.auth.checkExclusiveAccess.mockReturnValue(false)
        WIKI.auth.checkAccess.mockReturnValue(true)

        WIKI.models = {
          groups: {
            query: jest.fn(() => ({
              findById: jest.fn().mockResolvedValue({
                id: 4,
                $relatedQuery: jest.fn(() => ({
                  relate: jest.fn().mockResolvedValue(true)
                }))
              })
            }))
          },
          users: {
            query: jest.fn(() => ({
              findById: jest.fn().mockResolvedValue({ id: 5 })
            }))
          },
          knex: jest.fn(() => ({
            where: jest.fn(() => ({ first: jest.fn().mockResolvedValue(null) }))
          }))
        }

        global.WIKI = WIKI
      })

      afterEach(() => {
        jest.restoreAllMocks()
      })

      it('successfully assigns a user to a group', async () => {
        const args = { groupId: 4, userId: 5 }
        const result = await assignUser(null, args, { req })
        expect(result.responseResult).toEqual({
          'errorCode': 0,
          'message': 'User has been assigned to group.',
          'slug': 'ok',
          'succeeded': true
        })
        expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 5, kind: 'u' })
      })

      it('throws an error if user does not have permission to assign', async () => {
        req.user.permissions = []
        const args = { groupId: 3, userId: 5 }
        await expect(assignUser(null, args, { req })).rejects.toThrow(
          'Insufficient permissions to assign user to the group.'
        )
      })

      it('throws an error if the Guest user is being assigned', async () => {
        const args = { groupId: 4, userId: 2 }
        await expect(assignUser(null, args, { req })).rejects.toThrow(
          'Cannot assign the Guest user to a group.'
        )
      })

      it('throws an error if the group does not exist', async () => {
        const mockFindById = jest.fn().mockResolvedValue(null)
        WIKI.models.groups.query = jest.fn(() => ({ findById: mockFindById }))
        const args = { groupId: 99, userId: 5 }
        await expect(assignUser(null, args, { req })).rejects.toThrow('Invalid Group ID')
      })

      it('throws an error if the user does not exist', async () => {
        const mockFindById = jest.fn().mockResolvedValue(null)
        WIKI.models.users.query = jest.fn(() => ({ findById: mockFindById }))
        const args = { groupId: 4, userId: 99 }
        await expect(assignUser(null, args, { req })).rejects.toThrow('Invalid User ID')
      })

      it('throws an error if the user is already in the group', async () => {
        WIKI.models.knex = jest.fn(() => ({
          where: jest.fn(() => ({ first: jest.fn().mockResolvedValue(true) }))
        }))
        const args = { groupId: 4, userId: 5 }
        await expect(assignUser(null, args, { req })).rejects.toThrow(
          'User is already assigned to group.'
        )
      })
    })

    describe('Function unassignUser', () => {
      let req
      const { unassignUser } = groupResolvers.GroupMutation

      beforeEach(() => {
        req = {
          user: {
            id: 1,
            groups: [3, 4],
            permissions: ['manage:sites']
          }
        }

        WIKI.auth.isSuperAdmin.mockReturnValue(false)
        WIKI.auth.isSiteAdmin.mockReturnValue(true)
        WIKI.auth.checkExclusiveAccess.mockReturnValue(false)
        WIKI.auth.checkAccess.mockReturnValue(true)

        WIKI.models = {
          groups: {
            query: jest.fn(() => ({
              findById: jest.fn().mockResolvedValue({
                id: 3,
                $relatedQuery: jest.fn(() => ({
                  unrelate: jest.fn(() => ({
                    where: jest.fn().mockResolvedValue(true)
                  }))
                }))
              })
            }))
          },
          users: {
            query: jest.fn(() => ({
              findById: jest.fn().mockResolvedValue({ id: 5 })
            }))
          }
        }

        global.WIKI = WIKI
      })

      afterEach(() => {
        jest.restoreAllMocks()
      })

      it('successfully unassign a user from a group', async () => {
        const args = { groupId: 4, userId: 5 }
        const result = await unassignUser(null, args, { req })
        expect(result.responseResult).toEqual({
          'errorCode': 0,
          'message': 'User has been unassigned from group.',
          'slug': 'ok',
          'succeeded': true
        })
        expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 5, kind: 'u' })
      })

      it('throws an error if user does not have permission to unassign', async () => {
        req.user.permissions = []
        const args = { groupId: 3, userId: 5 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow(
          'Insufficient permissions to remove user from the group.'
        )
      })

      it('throws an error if the Guest user is being unassigned', async () => {
        const args = { groupId: 4, userId: 2 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow(
          'Cannot unassign Guest user'
        )
      })

      it('throws an error if the Administrator is being unassigned from Administrators group', async () => {
        const args = { groupId: 1, userId: 1 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow(
          'Insufficient permissions to remove user from the group.'
        )
      })

      it('throws an error if the group does not exist', async () => {
        const mockFindById = jest.fn().mockResolvedValue(null)
        WIKI.models.groups.query = jest.fn(() => ({ findById: mockFindById }))
        const args = { groupId: 99, userId: 5 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow('Invalid Group ID')
      })

      it('throws an error if the user does not exist', async () => {
        const mockFindById = jest.fn().mockResolvedValue(null)
        WIKI.models.users.query = jest.fn(() => ({ findById: mockFindById }))
        const args = { groupId: 4, userId: 99 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow('Invalid User ID')
      })
    })
  })
})
