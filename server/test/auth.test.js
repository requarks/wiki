const { checkAccess } = require('../core/auth')

const WIKI = {
  auth: {
    isSuperAdmin: jest.fn(),
    isSiteAdmin: jest.fn(),
    hasSitePermission: jest.fn(),
    groups: {}
  }
}

// const _ = require('lodash')

describe('checkAccess', () => {
  let user
  let page

  beforeEach(() => {
    user = { permissions: [], groups: [] }
    page = { siteId: 1, path: '/test', locale: 'en', tags: [] }

    WIKI.auth.isSuperAdmin.mockReset()
    WIKI.auth.isSiteAdmin.mockReset()
    WIKI.auth.hasSitePermission.mockReset()
  })

  it('returns true for Super Admin', () => {
    WIKI.auth.isSuperAdmin.mockReturnValue(true)
    const result = checkAccess(user, ['read'])
    expect(result).toBe(true)
  })

  it('returns true for Site Admin with site permission', () => {
    WIKI.auth.isSuperAdmin.mockReturnValue(false)
    WIKI.auth.isSiteAdmin.mockReturnValue(true)
    WIKI.auth.hasSitePermission.mockReturnValue(true)

    const result = checkAccess(user, ['read'], page)
    expect(result).toBe(true)
    expect(WIKI.auth.isSiteAdmin).toHaveBeenCalledWith(user)
    expect(WIKI.auth.hasSitePermission).toHaveBeenCalledWith(user, page.siteId, 'manage:sites')
  })

  it('returns false when user lacks global permissions', () => {
    user.permissions = ['edit']
    const result = checkAccess(user, ['read'])
    expect(result).toBe(false)
  })

  it('returns true for matching global permissions', () => {
    user.permissions = ['read', 'edit']
    const result = checkAccess(user, ['read'])
    expect(result).toBe(true)
  })

  it('returns true for matching START page rule', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: ['read'], match: 'START', path: '/test', deny: false }
        ]
      }
    }

    const result = checkAccess(user, ['read'], page)
    expect(result).toBe(true)
  })

  it('returns true for matching EXACT page rule', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: ['read'], match: 'EXACT', path: '/test', deny: false }
        ]
      }
    }

    const result = checkAccess(user, ['read'], page)
    expect(result).toBe(true)
  })

  it('returns false when a rule denies access', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: ['read'], match: 'EXACT', path: '/test', deny: true }
        ]
      }
    }

    const result = checkAccess(user, ['read'], page)
    expect(result).toBe(false)
  })

  it('handles REGEX rules correctly', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: [
          { sites: [1], roles: ['read'], match: 'REGEX', path: '^/test.*$', deny: false }
        ]
      }
    }

    page.path = '/test/path'
    const result = checkAccess(user, ['read'], page)
    expect(result).toBe(true)
  })

  it('returns false when no matching rules and ignoreRulePath is false', () => {
    user.groups = [{ id: 1 }]
    WIKI.auth.groups = {
      1: {
        rules: []
      }
    }

    const result = checkAccess(user, ['read'], page)
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

    const result = checkAccess(user, ['read'], page, true)
    expect(result).toBe(true)
  })
})
