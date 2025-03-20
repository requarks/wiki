const {
  isSuperAdmin,
  isSiteAdmin,
  hasSitePermission,
  _applyPageRuleSpecificity
} = require('../../core/auth')

const { canManageGroup, managedGroupsToSiteIds } = require('../../helpers/group')

const GroupEnum = {
  ADMINISTRATORS: 1,
  GUESTS: 2,
  REGULAR_USERS: 3,
  SITE_ADMINS_1: 4,
  SITE_ADMINS_2: 5,
  SITE_ADMINS_3: 6,
  GROUP_WITH_NO_PERMISSIONS: 7,
  GROUP_WITH_NO_RULES: 8,
  GROUP_WITH_NO_MANAGE_SITES_PERMISSIONS_AND_MANAGE_SITES_RULES: 9,
  GROUP_WITH_MANAGE_SITES_PERMISSIONS_AND_NO_MANAGE_SITES_RULES: 10
}

const WIKI = {
  auth: {
    isSuperAdmin: jest.fn(isSuperAdmin),
    isSiteAdmin: jest.fn(isSiteAdmin),
    hasSitePermission: jest.fn(hasSitePermission),
    _applyPageRuleSpecificity: jest.fn(_applyPageRuleSpecificity),
    groups: {
      [GroupEnum.ADMINISTRATORS]: {
        id: GroupEnum.ADMINISTRATORS,
        name: 'Administrators',
        permissions: ['manage:system'],
        rules: [],
        isSystem: true,
        createdAt: '2024-09-24T18:32:11.291Z',
        updatedAt: '2024-09-24T18:32:11.291Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.GUESTS]: {
        id: GroupEnum.GUESTS,
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
      [GroupEnum.REGULAR_USERS]: {
        id: GroupEnum.REGULAR_USERS,
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
              'bdc620e1-e7ed-4335-bf09-fc897bf43f5b',
              '2c8498a5-c45f-4621-abbc-7f5f3df8320f',
              'b722970a-e813-4b6a-8563-87ffc77827e5'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-09-25T15:10:16.326Z',
        updatedAt: '2024-12-05T18:48:32.442Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.SITE_ADMINS_1]: {
        id: GroupEnum.SITE_ADMINS_1,
        name: 'Site Admins 1',
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
              'b722970a-e813-4b6a-8563-87ffc77827e5',
              'd013a996-cb0e-4fc4-954a-fc89e94dfd49'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.SITE_ADMINS_2]: {
        id: GroupEnum.SITE_ADMINS_2,
        name: 'Site Admins 2',
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
              'b722970a-e813-4b6a-8563-87ffc77827e5',
              'd013a996-cb0e-4fc4-954a-fc89e94dfd49',
              '2c8498a5-c45f-4621-abbc-7f5f3df8320f'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.SITE_ADMINS_3]: {
        id: GroupEnum.SITE_ADMINS_3,
        name: 'Site Admins 3',
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
              'b722970a-e813-4b6a-8563-87ffc77827e5',
              'd013a996-cb0e-4fc4-954a-fc89e94dfd49',
              '2c8498a5-c45f-4621-abbc-7f5f3df8320f',
              'bdc620e1-e7ed-4335-bf09-fc897bf43f5b'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.GROUP_WITH_NO_PERMISSIONS]: {
        id: GroupEnum.GROUP_WITH_NO_PERMISSIONS,
        name: 'Group with no permissions',
        rules: [
          {
            id: 'default',
            deny: false,
            match: 'START',
            roles: ['manage:sites'],
            path: '',
            locales: [],
            sites: [
              'b722970a-e813-4b6a-8563-87ffc77827e5'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.GROUP_WITH_NO_RULES]: {
        id: GroupEnum.SITE_ADMINS_3,
        name: 'Group with no rules',
        permissions: ['manage:sites'],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.GROUP_WITH_NO_MANAGE_SITES_PERMISSIONS_AND_MANAGE_SITES_RULES]: {
        id: GroupEnum.GROUP_WITH_NO_MANAGE_SITES_PERMISSIONS_AND_MANAGE_SITES_RULES,
        name: 'Group with no rules',
        permissions: ['read:pages'],
        rules: [
          {
            id: 'default',
            deny: false,
            match: 'START',
            roles: ['manage:sites'],
            path: '',
            locales: [],
            sites: [
              'b722970a-e813-4b6a-8563-87ffc77827e5'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      },
      [GroupEnum.GROUP_WITH_MANAGE_SITES_PERMISSIONS_AND_NO_MANAGE_SITES_RULES]: {
        id: GroupEnum.GROUP_WITH_MANAGE_SITES_PERMISSIONS_AND_NO_MANAGE_SITES_RULES,
        name: 'Group with manage:sites permission and no managed:sites rules',
        permissions: [
          'manage:sites'
        ],
        rules: [
          {
            id: 'default',
            deny: false,
            match: 'START',
            roles: ['read:pages'],
            path: '',
            locales: [],
            sites: [
              'b722970a-e813-4b6a-8563-87ffc77827e5'
            ]
          }
        ],
        isSystem: false,
        createdAt: '2024-10-23T07:08:36.833Z',
        updatedAt: '2024-12-05T15:33:52.214Z',
        redirectOnLogin: '/'
      }
    }
  }
}
// const _ = require('lodash')
describe('canManageGroup', () => {
  describe('Super Admin', () => {
    let user

    beforeEach(() => {
      user = {
        id: 1,
        name: 'Administrator',
        groups: [GroupEnum.ADMINISTRATORS],
        permissions: ['manage:system']
      }

      global.WIKI = WIKI
    })

    it('can manage the group mentioned in the permissions', () => {
      const result = canManageGroup(user, GroupEnum.ADMINISTRATORS)
      expect(result).toBe(true)
    })

    it('can manage any group', () => {
      const result = canManageGroup(user, GroupEnum.GUESTS)
      expect(result).toBe(true)
    })
  })

  describe('Super Admin with id != 1', () => {
    let user

    beforeEach(() => {
      user = {
        id: 6,
        name: 'Administrator',
        groups: [GroupEnum.ADMINISTRATORS, GroupEnum.REGULAR_USERS, GroupEnum.SITE_ADMINS_1],
        permissions: ['manage:system']
      }

      global.WIKI = WIKI
    })

    it('can manage the group mentioned in the permissions', () => {
      const result = canManageGroup(user, GroupEnum.ADMINISTRATORS)
      expect(result).toBe(true)
    })

    it('can manage any group', () => {
      const result = canManageGroup(user, GroupEnum.GUESTS)
      expect(result).toBe(true)
    })
  })

  describe('Site Admin', () => {
    let user

    beforeEach(() => {
      user = {
        id: 4,
        name: 'Site Admin',
        groups: [GroupEnum.SITE_ADMINS_1],
        permissions: ['manage:sites']
      }

      global.WIKI = WIKI
    })

    it('can manage a group mentioned in the permissions', () => {
      const result = canManageGroup(user, GroupEnum.SITE_ADMINS_1)
      expect(result).toBe(true)
    })

    it('cannot manage a group they are not an admin of', () => {
      const result = canManageGroup(user, GroupEnum.REGULAR_USERS)
      expect(result).toBe(false)
    })
  })

  describe('Site Admin of multiple groups', () => {
    let user

    beforeEach(() => {
      user = {
        id: 4,
        name: 'Site Admin',
        groups: [GroupEnum.SITE_ADMINS_1, GroupEnum.SITE_ADMINS_2],
        permissions: ['manage:sites']
      }

      global.WIKI = WIKI
    })

    it('cannot manage admin group', () => {
      const result = canManageGroup(user, GroupEnum.ADMINISTRATORS)
      expect(result).toBe(false)
    })

    it('cannot manage guest group', () => {
      const result = canManageGroup(user, GroupEnum.GUESTS)
      expect(result).toBe(false)
    })

    it('cannot manage regular group', () => {
      const result = canManageGroup(user, GroupEnum.REGULAR_USERS)
      expect(result).toBe(false)
    })

    it('can manage own group with exact match', () => {
      const result = canManageGroup(user, GroupEnum.SITE_ADMINS_1)
      expect(result).toBe(true)
    })

    it('can manage own group with superset', () => {
      const result = canManageGroup(user, GroupEnum.SITE_ADMINS_2)
      expect(result).toBe(true)
    })

    it('cannot manage a different group with partial overlap', () => {
      const result = canManageGroup(user, GroupEnum.SITE_ADMINS_3)
      expect(result).toBe(false)
    })
  })

  describe('Regular User', () => {
    let user

    beforeEach(() => {
      user = {
        id: 3,
        name: 'Regular User',
        groups: [GroupEnum.REGULAR_USERS],
        permissions: [
          'read:pages',
          'read:assets',
          'read:comments',
          'write:comments'
        ]
      }

      global.WIKI = WIKI
    })

    it('cannot manage superadmin group', () => {
      const result = canManageGroup(user, GroupEnum.ADMINISTRATORS)
      expect(result).toBe(false)
    })

    it('cannot manage guest group', () => {
      const result = canManageGroup(user, GroupEnum.GUESTS)
      expect(result).toBe(false)
    })

    it('cannot manage site admin group', () => {
      const result = canManageGroup(user, GroupEnum.SITE_ADMINS_1)
      expect(result).toBe(false)
    })

    it('cannot manage site admin group', () => {
      const result = canManageGroup(user, GroupEnum.SITE_ADMINS_3)
      expect(result).toBe(false)
    })
  })
})

describe('managedGroupsToSiteIds', () => {
  it('returns empty sites array for managed group with no permissions', () => {
    const result = managedGroupsToSiteIds([GroupEnum.GROUP_WITH_NO_PERMISSIONS])
    expect(result).toEqual([])
  })

  it('returns empty sites array for managed group with no rules', () => {
    const result = managedGroupsToSiteIds([GroupEnum.GROUP_WITH_NO_RULES])
    expect(result).toEqual([])
  })
  it('returns empty sites array for managed group with no managed:sites permissions', () => {
    const result = managedGroupsToSiteIds([GroupEnum.GROUP_WITH_NO_MANAGE_SITES_PERMISSIONS_AND_MANAGE_SITES_RULES])
    expect(result).toEqual([])
  })
  it('returns empty sites array for managed group with no managed:sites rules', () => {
    const result = managedGroupsToSiteIds([GroupEnum.GROUP_WITH_MANAGE_SITES_PERMISSIONS_AND_NO_MANAGE_SITES_RULES])
    expect(result).toEqual([])
  })
  it('returns empty sites array for group with no manage:sites permissions and no manage:sites rule', () => {
    const result = managedGroupsToSiteIds([GroupEnum.REGULAR_USERS])
    expect(result).toEqual([])
  })
  it('returns managed sites for only groups with manage:sites permissions and manage:sites rule', () => {
    const result = managedGroupsToSiteIds([GroupEnum.SITE_ADMINS_1, GroupEnum.REGULAR_USERS])
    expect(result).toEqual(['b722970a-e813-4b6a-8563-87ffc77827e5', 'd013a996-cb0e-4fc4-954a-fc89e94dfd49'])
  })
  it('returns unique list of managed sites for group with manage:sites permissions and manage:sites rule', () => {
    const result = managedGroupsToSiteIds([GroupEnum.SITE_ADMINS_1, GroupEnum.SITE_ADMINS_2])
    expect(result).toEqual(['b722970a-e813-4b6a-8563-87ffc77827e5', 'd013a996-cb0e-4fc4-954a-fc89e94dfd49', '2c8498a5-c45f-4621-abbc-7f5f3df8320f'])
  })
})
