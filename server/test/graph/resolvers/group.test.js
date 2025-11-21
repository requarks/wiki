const TestGroup = {
  ADMINISTRATORS: 1,
  GUESTS: 2,
  REGULAR_USERS: 3,
  SITE_ADMINS: 4
}

const WIKI = {
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  auth: {
    isSuperAdmin: jest.fn(),
    isSiteAdmin: jest.fn(),
    checkExclusiveAccess: jest.fn(),
    checkAccess: jest.fn(),
    revokeUserTokens: jest.fn(),
    reloadGroups: jest.fn(),
    groups: {
      [TestGroup.ADMINISTRATORS]: {
        id: TestGroup.ADMINISTRATORS,
        name: 'Administrators',
        permissions: ['manage:system'],
        rules: [],
        isSystem: true,
        createdAt: '2024-09-24T18:32:11.291Z',
        updatedAt: '2024-09-24T18:32:11.291Z',
        redirectOnLogin: '/'
      },
      [TestGroup.GUESTS]: {
        id: TestGroup.GUESTS,
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
      [TestGroup.REGULAR_USERS]: {
        id: TestGroup.REGULAR_USERS,
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
      [TestGroup.SITE_ADMINS]: {
        id: TestGroup.SITE_ADMINS,
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
  data: {
    groups: {
      defaultPermissions: [],
      defaultPageRules: [{}]
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

// At the top of your test file
jest.mock('../../../graph/services/userSiteInactivityService', () => ({
  getSiteIdsFromGroups: jest.fn(),
  handleUserSiteInactivityAfterUnassign: jest.fn()
}))

let groupResolvers = require('../../../graph/resolvers/group')
const { getSiteIdsFromGroups } = require('../../../graph/services/userSiteInactivityService')

describe('Group Resolvers', () => {
  let req

  beforeEach(() => {
    req = {
      user: {
        groups: [TestGroup.REGULAR_USERS, TestGroup.SITE_ADMINS]
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
      function getGroupQueryMock({ findOneResult = null, patchResult = TestGroup.SITE_ADMINS } = {}) {
        return {
          findOne: jest.fn().mockResolvedValue(findOneResult),
          patch: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(patchResult)
          })
        }
      }

      it('should update group details', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        const result = await groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-4'] }] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
        expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: TestGroup.SITE_ADMINS, kind: 'g' })
        expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: TestGroup.SITE_ADMINS, kind: 'g' })
      })

      it('should throw error for unsafe regex in page rules', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        await expect(groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: [], rules: [{ match: 'REGEX', path: '(a+){10}' }] }, { req }))
          .rejects
          .toThrow('Some Page Rules contains unsafe or exponential time regex.')
      })

      it('should throw error if non-super admin tries to assign system permissions', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        await expect(groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: ['manage:system'], rules: [] }, { req }))
          .rejects
          .toThrow('You are not authorized to assign the system permissions.')
      })

      it('should throw error if non-super admin tries to assign multiple system permissions', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        await expect(groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: ['manage:system', 'manage:api'], rules: [] }, { req }))
          .rejects
          .toThrow('You are not authorized to assign the system permissions.')
      })

      it('should throw error if non-super admin tries to assign mixed permissions including system permissions', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        await expect(groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: ['manage:system', 'read:pages'], rules: [] }, { req }))
          .rejects
          .toThrow('You are not authorized to assign the system permissions.')
      })

      it('should not throw error if non-super admin assigns non-system permissions', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        const result = await groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: ['read:pages'], rules: [] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
        expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: TestGroup.SITE_ADMINS, kind: 'g' })
        expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: TestGroup.SITE_ADMINS, kind: 'g' })
      })

      it('should allow non-super admin to assign write:users permission', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        const result = await groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: ['write:users'], rules: [] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
        expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: TestGroup.SITE_ADMINS, kind: 'g' })
        expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: TestGroup.SITE_ADMINS, kind: 'g' })
      })

      it('should throw error if user tries to update group with invalid site access', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        WIKI.auth.checkAccess.mockReturnValue(false)
        await expect(groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-1'], path: '/' }] }, { req }))
          .rejects
          .toThrow('Insufficient permissions to update access to sites.')
      })

      it('should update group with valid site access', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        const result = await groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-4'], path: '/' }] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
      })

      it('should throw error if user tries to update a non managed group', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock())
        await expect(groupResolvers.GroupMutation.update(null, { id: TestGroup.REGULAR_USERS, name: 'Updated Group', permissions: [], rules: [{ sites: ['SITE-1'], path: '/' }] }, { req }))
          .rejects
          .toThrow('Insufficient permissions to update the group.')
      })

      it('should throw error if group name already exists for another group', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock({ findOneResult: { id: 123, name: 'Duplicate Group' } }))
        await expect(groupResolvers.GroupMutation.update(null, { id: 456, name: 'Duplicate Group', permissions: [], rules: [{ sites: ['SITE-4'] }] }, { req }))
          .rejects
          .toThrow('A group with this name already exists.')
      })
      it('should update group if name is unique or same as current group', async () => {
        // Case: name is unique
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock({ findOneResult: null }))
        let result = await groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Unique Group', permissions: [], rules: [{ sites: ['SITE-4'] }] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')

        // Case: name is same as current group (should not throw)
        WIKI.models.groups.query.mockReturnValue(getGroupQueryMock({ findOneResult: { id: TestGroup.SITE_ADMINS, name: 'Same Group' } }))
        result = await groupResolvers.GroupMutation.update(null, { id: TestGroup.SITE_ADMINS, name: 'Same Group', permissions: [], rules: [{ sites: ['SITE-4'] }] }, { req })
        expect(result.responseResult.message).toBe('Group has been updated.')
      })
    })

    describe('Function assignUser', () => {
      let req
      const { assignUser } = groupResolvers.GroupMutation

      beforeEach(() => {
        req = {
          user: {
            id: 1,
            groups: [TestGroup.REGULAR_USERS, TestGroup.SITE_ADMINS],
            permissions: ['manage:sites']
          }
        }

        WIKI.auth.isSuperAdmin.mockReturnValue(false)
        WIKI.auth.isSiteAdmin.mockReturnValue(true)
        WIKI.auth.checkExclusiveAccess.mockReturnValue(false)
        WIKI.auth.checkAccess.mockReturnValue(true)

        const relateMock = jest.fn().mockResolvedValue(true)
        WIKI.models = {
          groups: {
            query: jest.fn(() => ({
              findById: jest.fn().mockResolvedValue({
                id: TestGroup.SITE_ADMINS,
                $relatedQuery: jest.fn(() => ({ relate: relateMock }))
              }),
              join: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis()
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

        // Expose relateMock for tests
        WIKI.__tests = { relateMock }

        global.WIKI = WIKI
      })

      afterEach(() => {
        jest.restoreAllMocks()
      })

      it('successfully assigns a user to a group', async () => {
        const args = { groupId: TestGroup.SITE_ADMINS, userId: 5 }
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
        const args = { groupId: TestGroup.REGULAR_USERS, userId: 5 }
        await expect(assignUser(null, args, { req })).rejects.toThrow(
          'Insufficient permissions to assign user to the group.'
        )
      })

      it('throws an error if the Guest user is being assigned', async () => {
        const args = { groupId: TestGroup.SITE_ADMINS, userId: 2 }
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
        const args = { groupId: TestGroup.SITE_ADMINS, userId: 99 }
        await expect(assignUser(null, args, { req })).rejects.toThrow('Invalid User ID')
      })

      it('throws an error if the user is already in the group (unique constraint violation)', async () => {
        // Simulate the relate call throwing a Postgres unique violation
        WIKI.__tests.relateMock.mockRejectedValueOnce({ code: '23505', message: 'duplicate key value violates unique constraint "user_groups_user_group_unique"' })
        const args = { groupId: TestGroup.SITE_ADMINS, userId: 5 }
        await expect(assignUser(null, args, { req })).rejects.toThrow('User is already assigned to group.')
      })
    })

    describe('Function unassignUser', () => {
      let req
      const { unassignUser } = groupResolvers.GroupMutation

      beforeEach(() => {
        req = {
          user: {
            id: 1,
            groups: [TestGroup.REGULAR_USERS, TestGroup.SITE_ADMINS],
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
                id: TestGroup.REGULAR_USERS,
                $relatedQuery: jest.fn(() => ({
                  unrelate: jest.fn(() => ({
                    where: jest.fn().mockResolvedValue(true)
                  }))
                }))
              }),
              join: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis()
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
        const args = { groupId: TestGroup.SITE_ADMINS, userId: 5 }
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
        const args = { groupId: TestGroup.REGULAR_USERS, userId: 5 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow(
          'Insufficient permissions to remove user from the group.'
        )
      })

      it('throws an error if the Guest user is being unassigned', async () => {
        const args = { groupId: TestGroup.SITE_ADMINS, userId: 2 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow(
          'Cannot unassign Guest user'
        )
      })

      it('throws an error if the Administrator is being unassigned from Administrators group', async () => {
        const args = { groupId: TestGroup.ADMINISTRATORS, userId: 1 }
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
        const args = { groupId: TestGroup.SITE_ADMINS, userId: 99 }
        await expect(unassignUser(null, args, { req })).rejects.toThrow('Invalid User ID')
      })
    })
    // Helper functions to avoid deep nesting in tests
    function mockGetSiteIdsFromGroupsForSiteLoss(groups) {
      // groupsToRemove: contains SITE_ADMINS
      if (Array.isArray(groups) && groups.some(g => g.id === TestGroup.SITE_ADMINS)) {
        return new Set(['SITE-1', 'SITE-2'])
      }
      // groupsToKeep: contains GUESTS
      if (Array.isArray(groups) && groups.some(g => g.id === TestGroup.GUESTS)) {
        return new Set(['SITE-2'])
      }
      // fallback
      return new Set()
    }

    function mockGetSiteIdsFromGroupsNoSiteLoss(groups) {
      if (Array.isArray(groups)) {
        // groupsToRemove: SITE_ADMINS
        return new Set(['SITE-2'])
      }
      // groupsToKeep: GUESTS
      return new Set(['SITE-2'])
    }

    function mockGetSiteIdsFromGroupsMultiple(groups) {
      if (Array.isArray(groups) && groups.length === 2) {
        // groupsToRemove: both groups
        return new Set(['SITE-1', 'SITE-2', 'SITE-3', 'SITE-4'])
      }
      // groupsToKeep: none
      return new Set()
    }
    function mockKnexWhereFirstNull() {
      return {
        where: jest.fn(() => ({
          first: jest.fn().mockResolvedValue(null)
        }))
      }
    }
    function mockGetSiteById({ siteId }) {
      return Promise.resolve({
        id: siteId,
        name: `Site ${siteId}`
      })
    }
    function mockKnexUserGroupsPluck() {
      return {
        where: jest.fn(() => ({
          pluck: jest.fn().mockResolvedValue([TestGroup.SITE_ADMINS, TestGroup.GUESTS])
        }))
      }
    }

    describe('isLastGroupForSiteGeneric', () => {
      let req

      beforeEach(() => {
        req = {
          user: {
            id: 1,
            groups: [TestGroup.REGULAR_USERS, TestGroup.SITE_ADMINS],
            permissions: ['manage:sites']
          }
        }
        WIKI.auth.isSuperAdmin.mockReturnValue(false)
        WIKI.auth.isSiteAdmin.mockReturnValue(true)
        WIKI.auth.checkExclusiveAccess.mockReturnValue(false)
        WIKI.auth.checkAccess.mockReturnValue(true)
        WIKI.models.knex = jest.fn(mockKnexWhereFirstNull)
        WIKI.models.sites = {
          getSiteById: jest.fn(mockGetSiteById)
        }
        WIKI.models.knex = jest.fn(mockKnexUserGroupsPluck)
        global.WIKI = WIKI
      })

      afterEach(() => {
        jest.clearAllMocks()
      })

      it('returns affectedSites and isLastGroupForAnySite=true if removing group(s) causes site loss', async () => {
        WIKI.models.groups.query.mockReturnValue({
          whereIn: jest.fn().mockResolvedValue([
            { id: TestGroup.SITE_ADMINS, rules: [{ sites: ['SITE-1', 'SITE-2'] }] },
            { id: TestGroup.GUESTS, rules: [{ sites: ['SITE-2'] }] }
          ])
        })

        getSiteIdsFromGroups.mockImplementation(mockGetSiteIdsFromGroupsForSiteLoss)

        const args = { userId: 5, groupIds: [TestGroup.SITE_ADMINS] }
        const result = await groupResolvers.Query.isLastGroupForSiteGeneric(
          null,
          args,
          { req }
        )
        expect(result.isLastGroupForAnySite).toBe(true)
        expect(result.affectedSites).toEqual([{ id: 'SITE-1', name: 'Site SITE-1' }])
        expect(WIKI.models.sites.getSiteById).toHaveBeenCalledWith({ siteId: 'SITE-1', forceReload: true })
      })

      it('returns isLastGroupForAnySite=false and empty affectedSites if removing group(s) does not cause site loss', async () => {
        WIKI.models.groups.query.mockReturnValue({
          whereIn: jest.fn().mockResolvedValue([
            { id: TestGroup.SITE_ADMINS, rules: [{ sites: ['SITE-2'] }] },
            { id: TestGroup.GUESTS, rules: [{ sites: ['SITE-2'] }] }
          ])
        })

        getSiteIdsFromGroups.mockImplementation(mockGetSiteIdsFromGroupsNoSiteLoss)

        const args = { userId: 5, groupIds: [TestGroup.SITE_ADMINS] }
        const result = await groupResolvers.Query.isLastGroupForSiteGeneric(
          null,
          args,
          { req }
        )
        expect(result.isLastGroupForAnySite).toBe(false)
        expect(result.affectedSites).toEqual([])
      })

      it('works with multiple groupIds', async () => {
        WIKI.models.groups.query.mockReturnValue({
          whereIn: jest.fn().mockResolvedValue([
            { id: TestGroup.SITE_ADMINS, rules: [{ sites: ['SITE-4'] }] },
            { id: TestGroup.REGULAR_USERS, rules: [{ sites: ['SITE-1', 'SITE-2', 'SITE-3', 'SITE-4'] }] }
          ])
        })

        getSiteIdsFromGroups.mockImplementation(mockGetSiteIdsFromGroupsMultiple)

        const args = { userId: 5, groupIds: [TestGroup.SITE_ADMINS, TestGroup.REGULAR_USERS] }
        const result = await groupResolvers.Query.isLastGroupForSiteGeneric(
          null,
          args,
          { req }
        )
        expect(result.isLastGroupForAnySite).toBe(true)
        expect(result.affectedSites).toEqual([
          { id: 'SITE-1', name: 'Site SITE-1' },
          { id: 'SITE-2', name: 'Site SITE-2' },
          { id: 'SITE-3', name: 'Site SITE-3' },
          { id: 'SITE-4', name: 'Site SITE-4' }
        ])
      })
    })

    describe('create', () => {
      function getGroupCreateQueryMock({ findOneResult = null, insertAndFetchResult = { id: 999, name: 'Unique Group' } } = {}) {
        return {
          findOne: jest.fn().mockResolvedValue(findOneResult),
          insertAndFetch: jest.fn().mockResolvedValue(insertAndFetchResult)
        }
      }
      it('should throw error if group name already exists', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupCreateQueryMock({ findOneResult: { id: 123, name: 'Existing Group' } }))
        await expect(groupResolvers.GroupMutation.create(null, { name: 'Existing Group', permissions: [], rules: [] }, { req }))
          .rejects
          .toThrow('A group with this name already exists.')
      })

      it('should create group if name is unique', async () => {
        WIKI.models.groups.query.mockReturnValue(getGroupCreateQueryMock())
        WIKI.auth.isSuperAdmin.mockReturnValue(true)
        WIKI.models.sites = {
          getSiteIdByPath: jest.fn().mockResolvedValue('SITE-DEFAULT')
        }
        const result = await groupResolvers.GroupMutation.create(null, { name: 'Unique Group', permissions: [], rules: [{}] }, { req })
        expect(result.group.name).toBe('Unique Group')
        expect(result.responseResult.message).toBe('Group created successfully.')
      })
    })
  })
})
