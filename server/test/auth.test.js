const {
  checkAccess,
  isSuperAdmin,
  isSiteAdmin,
  hasSitePermission,
  _applyPageRuleSpecificity
} = require('../core/auth')
const auth = require('../core/auth')

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

  it('can reach the admin zone', () => {
    const result = auth.checkAccess(user, [ 'read:pages', 'manage:sites' ])
    expect(result).toBe(true)
  })

  it('can reach a page not explicitly mentioned in rules', () => {
    const result = auth.checkAccess(
      user,
      [ 'read:pages', 'manage:sites' ],
      { siteId: 'c2f927cf-fb55-4686-a7e9-f4911a3b225a' }
    )
    expect(result).toBe(true)
  })
})

describe('Site Admin', () => {
  let user
  let page

  beforeEach(() => {
    user = {
      id: 2,
      name: 'Site Admin',
      groups: [ 4 ],
      permissions: [ 'manage:sites' ]
    }
    page = { siteId: 1, path: '/test', locale: 'en', tags: [] }

    global.WIKI = WIKI
  })

  it('can access the admin zone', () => {
    const result = auth.checkAccess(user, [ 'read:pages', 'manage:sites' ])
    expect(result).toBe(true)
  })

  it('can access the page they manage', () => {
    const siteId = 'b722970a-e813-4b6a-8563-87ffc77827e5'

    const result = auth.checkAccess(
      user,
      [ 'read:pages', 'manage:sites' ],
      { siteId }
    )
    expect(result).toBe(true)
    expect(WIKI.auth.isSiteAdmin).toHaveBeenCalledWith(user)
    expect(WIKI.auth.hasSitePermission).toHaveBeenCalledWith(user, siteId, 'manage:sites')
  })

  it('cannot access the page they do not manage', () => {
    const siteId = '2c8498a5-c45f-4621-abbc-7f5f3df8320f'

    const result = auth.checkAccess(
      user,
      [ 'read:pages', 'manage:sites' ],
      { siteId }
    )
    expect(result).toBe(false)
    expect(WIKI.auth.isSiteAdmin).toHaveBeenCalledWith(user)
    expect(WIKI.auth.hasSitePermission).toHaveBeenCalledWith(user, siteId, 'manage:sites')
  })

  it('can edit the page they manage', () => {
    const siteId = 'b722970a-e813-4b6a-8563-87ffc77827e5'

    const result = auth.checkAccess(
      user,
      [ 'write:pages', 'manage:sites' ],
      { siteId }
    )
    expect(result).toBe(true)
    expect(WIKI.auth.isSiteAdmin).toHaveBeenCalledWith(user)
    expect(WIKI.auth.hasSitePermission).toHaveBeenCalledWith(user, siteId, 'manage:sites')
  })

  it('cannot edit the page they do not manage', () => {
    const siteId = '2c8498a5-c45f-4621-abbc-7f5f3df8320f'

    const result = auth.checkAccess(
      user,
      [ 'write:pages', 'manage:sites' ],
      { siteId }
    )
    expect(result).toBe(false)
    expect(WIKI.auth.isSiteAdmin).toHaveBeenCalledWith(user)
    expect(WIKI.auth.hasSitePermission).toHaveBeenCalledWith(user, siteId, 'manage:sites')
  })

  it('can edit the page they have view rights', () => {
    const siteId = 'b722970a-e813-4b6a-8563-87ffc77827e5'

    const result = auth.checkAccess(
      user,
      [ 'write:pages', 'manage:sites' ],
      { siteId }
    )
    expect(result).toBe(true)
    expect(WIKI.auth.isSiteAdmin).toHaveBeenCalledWith(user)
    expect(WIKI.auth.hasSitePermission).toHaveBeenCalledWith(user, siteId, 'manage:sites')
  })
})

describe('Regular User', () => {
  let user
  let page

  beforeEach(() => {
    user = {
      id: 3,
      name: 'Regular User',
      groups: [ 3 ],
      permissions: [ 'read:pages', 'read:assets', 'read:comments' ]
    }
    page = { siteId: 1, path: '/test', locale: 'en', tags: [] }

    global.WIKI = WIKI
  })

  it('cannot access the admin zone', () => {
    const result = auth.checkAccess(user, [ 'manage:sites' ])
    expect(result).toBe(false)
  })

  it('can access the page they have read rights', () => {
    const siteId = 'b722970a-e813-4b6a-8563-87ffc77827e5'

    const result = auth.checkAccess(
      user,
      [ 'read:pages' ],
      { siteId }
    )
    expect(result).toBe(true)
    expect(WIKI.auth.isSiteAdmin).toHaveBeenCalledWith(user)
  })

  it('cannot access the page they do not have read rights', () => {
    const siteId = 'd013a996-cb0e-4fc4-954a-fc89e94dfd49'

    const result = auth.checkAccess(
      user,
      [ 'read:pages' ],
      { siteId }
    )
    expect(result).toBe(false)
  })

  it('cannot edit the page they have read access', () => {
    const siteId = 'b722970a-e813-4b6a-8563-87ffc77827e5'

    const result = auth.checkAccess(
      user,
      [ 'write:pages' ],
      { siteId }
    )
    expect(result).toBe(false)
  })

  it('cannot edit the page they do not have rights', () => {
    const siteId = '2c8498a5-c45f-4621-abbc-7f5f3df8320f'

    const result = auth.checkAccess(
      user,
      [ 'write:pages' ],
      { siteId }
    )
    expect(result).toBe(false)
  })

  it('returns true for matching START page rule', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: [ 'read:pages', 'manage:sites' ], match: 'START', path: '/test', deny: false }
        ]
      }
    }

    const result = auth.checkAccess(user, ['read:pages'], page)
    expect(result).toBe(true)
  })

  it('returns true for matching EXACT page rule', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: [ 'read:pages', 'manage:sites' ], match: 'EXACT', path: '/test', deny: false }
        ]
      }
    }

    const result = auth.checkAccess(user, [ 'read:pages', 'manage:sites' ], page)
    expect(result).toBe(true)
  })

  it('returns false when a rule denies access', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: [ 'read:pages', 'manage:sites' ], match: 'EXACT', path: '/test', deny: true }
        ]
      }
    }

    const result = auth.checkAccess(user, ['read:pages'], page)
    expect(result).toBe(false)
  })

  it('handles REGEX rules correctly', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: [ 'read:pages', 'manage:sites' ], match: 'REGEX', path: '^/test.*$', deny: false }
        ]
      }
    }

    page.path = '/test/path'
    const result = auth.checkAccess(user, [ 'read:pages', 'manage:sites' ], page)
    expect(result).toBe(true)
  })

  it('returns false when no matching rules and ignoreRulePath is false', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: []
      }
    }

    const result = auth.checkAccess(user, [ 'read:pages', 'manage:sites' ], page)
    expect(result).toBe(false)
  })

  it('ignores rule paths if ignoreRulePath is true', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: ['manage:sites'], match: 'START', path: '/test', deny: false }
        ]
      }
    }

    const result = auth.checkAccess(user, [ 'read:pages', 'manage:sites' ], page, true)
    expect(result).toBe(true)
  })
})

