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
        permissions: [ 'manage:system' ],
        rules: [],
        isSystem: true,
        createdAt: '2024-09-24T18:32:11.291Z',
        updatedAt: '2024-09-24T18:32:11.291Z',
        redirectOnLogin: '/'
      },
      '2': {
        id: 2,
        name: 'Guests',
        permissions: [ 'read:pages', 'read:assets', 'read:comments' ],
        rules: [
          {
            id: 'guest',
            deny: false,
            match: 'START',
            roles: [ 'read:pages', 'read:assets', 'read:comments' ],
            path: '',
            locales: [],
            sites: [ 'b722970a-e813-4b6a-8563-87ffc77827e5' ]
          },
          {
            id: '222813d816',
            deny: false,
            match: 'START',
            roles: [ 'read:pages', 'read:assets', 'read:comments' ],
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
              'SITE-3'
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
            roles: [ 'manage:sites' ],
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
  }
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

        const result = await groupResolvers.GroupMutation.update(null, { id: 4, name: 'Updated Group', permissions: [], rules: [] }, { req })
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
  })
})
