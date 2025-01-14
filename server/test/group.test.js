const {
  checkAccess,
  isSuperAdmin,
  isSiteAdmin,
  hasSitePermission,
  _applyPageRuleSpecificity
} = require('../core/auth')
const group = require('../graph/resolvers/group')

// const { canManageGroup } = require('../graph/resolvers/group')

const WIKI = {
  auth: {
    isSuperAdmin: jest.fn(isSuperAdmin),
    isSiteAdmin: jest.fn(isSiteAdmin),
    hasSitePermission: jest.fn(hasSitePermission),
    _applyPageRuleSpecificity: jest.fn(_applyPageRuleSpecificity),
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
              'b722970a-e813-4b6a-8563-87ffc77827e5',
              'bdc620e1-e7ed-4335-bf09-fc897bf43f5b',
              'd013a996-cb0e-4fc4-954a-fc89e94dfd49'
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

describe('Super Admin', () => {
  let user

  beforeEach(() => {
    user = {
      id: 1,
      name: 'Administrator',
      groups: [ 1 ],
      permissions: [ 'manage:system' ]
    }

    global.WIKI = WIKI
  })

  it('can manage group mentioned in permissions', () => {
    const result = group.canManageGroup(user, 1)
    expect(result).toBe(true)
  })

  it('can manage any group', () => {
    const result = group.canManageGroup(user, 2)
    expect(result).toBe(true)
  })
})

describe('Site Admin', () => {
  let user

  beforeEach(() => {
    user = {
      id: 4,
      name: 'Site Admin',
      groups: [ 4 ],
      permissions: [ 'manage:sites' ]
    }

    global.WIKI = WIKI
  })

  it('can manage group mentioned in permissions', () => {
    const result = group.canManageGroup(user, 1)
    expect(result).toBe(true)
  })

})

describe('Regular User', () => {
  let user

  beforeEach(() => {
    user = {
      id: 3,
      name: 'Regular User',
      groups: [ 1 ],
      permissions: [
        'read:pages',
        'read:assets',
        'read:comments',
        'write:comments'
      ]
    }

    global.WIKI = WIKI
  })

  it('cannot manage any groups', () => {
    const result = group.canManageGroup(user, 2)
    expect(result).toBe(false)
  })
})
