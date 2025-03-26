const notifyUsers = require('../../jobs/notify-users')

const WIKI = {
  auth: {
    checkAccess: jest.fn()
  },
  mail: {
    send: jest.fn()
  },
  models: {
    users: {
      query: jest.fn()
    },
    groups: {
      query: jest.fn()
    }
  },
  config: {
    host: 'https://example.com',
    mail: {
      allowedDomains: ''
    }
  },
  logger: {
    warn: jest.fn(),
    info: jest.fn()
  },
  events: {
    outbound: {
      emit: jest.fn()
    }
  }
}

describe('notifyUsers', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should notify users with read access', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = [2, 3, 4]
    const event = 'UPDATE_PAGE'

    const users = [
      { id: 2, email: 'user1@example.com', isActive: true, groupIds: [1] },
      { id: 3, email: 'user2@example.com', isActive: true, groupIds: [2] },
      { id: 4, email: 'user3@example.com', isActive: false, groupIds: [3] }
    ]

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] },
      { id: 2, permissions: ['read:pages'], rules: [] },
      { id: 3, permissions: [], rules: [] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Updated' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(1)
    expect(WIKI.mail.send).toHaveBeenCalledWith({
      template: 'page-notify',
      to: '',
      bcc: ['user1@example.com', 'user2@example.com'],
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        isDeletion: false,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        event: event,
        eventText: 'updated'
      }
    })
  })

  it('should notify users with read access in batches', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = Array.from({ length: 25 }, (_, i) => i + 1) // Generate 25 user IDs
    const event = 'UPDATE_PAGE'

    const users = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      email: `user${i + 1}@example.com`,
      isActive: true,
      groupIds: [1]
    }))

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Updated' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(3) // Expect 3 batches of emails
    expect(WIKI.mail.send).toHaveBeenNthCalledWith(1, {
      template: 'page-notify',
      to: '',
      bcc: users.slice(0, 10).map(f => f.email),
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        isDeletion: false,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        event: event,
        eventText: 'updated'
      }
    })
    expect(WIKI.mail.send).toHaveBeenNthCalledWith(2, {
      template: 'page-notify',
      to: '',
      bcc: users.slice(10, 20).map(f => f.email),
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        isDeletion: false,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        event: event,
        eventText: 'updated'
      }
    })
    expect(WIKI.mail.send).toHaveBeenNthCalledWith(3, {
      template: 'page-notify',
      to: '',
      bcc: users.slice(20, 25).map(f => f.email),
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        isDeletion: false,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        event: event,
        eventText: 'updated'
      }
    })
  })

  it('should not notify inactive users', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = [2, 3, 4]
    const event = 'UPDATE_PAGE'

    const users = [
      { id: 2, email: 'user1@example.com', isActive: false, groupIds: [1] },
      { id: 3, email: 'user2@example.com', isActive: false, groupIds: [2] },
      { id: 4, email: 'user3@example.com', isActive: false, groupIds: [3] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    await notifyUsers({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Updated' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.auth.checkAccess).not.toHaveBeenCalled()
    expect(WIKI.mail.send).not.toHaveBeenCalled()
  })

  it('should notify users with read access for CREATE_PAGE event', async () => {
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = [2, 3, 4]
    const event = 'CREATE_PAGE'

    const users = [
      { id: 2, email: 'user1@example.com', isActive: true, groupIds: [1] },
      { id: 3, email: 'user2@example.com', isActive: true, groupIds: [2] },
      { id: 4, email: 'user3@example.com', isActive: false, groupIds: [3] }
    ]

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] },
      { id: 2, permissions: ['read:pages'], rules: [] },
      { id: 3, permissions: [], rules: [] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({ siteId: 1, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Created' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(1)
    expect(WIKI.mail.send).toHaveBeenCalledWith({
      template: 'page-notify',
      to: '',
      bcc: ['user1@example.com', 'user2@example.com'],
      subject: `[Page Notification] Page Created: ${pageTitle}`,
      data: {
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        pageTitle,
        userEmail,
        event: event,
        eventText: 'created',
        isDeletion: false
      }
    })
  })

  it('should notify users with read access for DELETE_PAGE event', async () => {
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = [2, 3, 4]
    const event = 'DELETE_PAGE'

    const users = [
      { id: 2, email: 'user1@example.com', isActive: true, groupIds: [1] },
      { id: 3, email: 'user2@example.com', isActive: true, groupIds: [2] },
      { id: 4, email: 'user3@example.com', isActive: false, groupIds: [3] }
    ]

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] },
      { id: 2, permissions: ['read:pages'], rules: [] },
      { id: 3, permissions: [], rules: [] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({ siteId: 1, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Deleted' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(1)
    expect(WIKI.mail.send).toHaveBeenCalledWith({
      template: 'page-notify',
      to: '',
      bcc: ['user1@example.com', 'user2@example.com'],
      subject: `[Page Notification] Page Deleted: ${pageTitle}`,
      data: {
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        pageTitle,
        userEmail,
        event: event,
        eventText: 'deleted',
        isDeletion: true
      }
    })
  })
  it('should notify users with allowed domains', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = [2, 3, 4]
    const event = 'UPDATE_PAGE'

    const users = [
      { id: 2, email: 'user1@alloweddomain.com', isActive: true, groupIds: [1] },
      { id: 3, email: 'user2@alloweddomain.com', isActive: true, groupIds: [2] },
      { id: 4, email: 'user3@notalloweddomain.com', isActive: true, groupIds: [3] }
    ]

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] },
      { id: 2, permissions: ['read:pages'], rules: [] },
      { id: 3, permissions: [], rules: [] }
    ]

    WIKI.config.mail.allowedDomains = 'alloweddomain.com'

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Updated' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(1)
    expect(WIKI.mail.send).toHaveBeenCalledWith({
      template: 'page-notify',
      to: '',
      bcc: ['user1@alloweddomain.com', 'user2@alloweddomain.com'],
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        isDeletion: false,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        event: event,
        eventText: 'updated'
      }
    })
  })

  it('should notify users with multiple allowed domains', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = [2, 3, 4]
    const event = 'UPDATE_PAGE'

    const users = [
      { id: 2, email: 'user1@alloweddomain1.com', isActive: true, groupIds: [1] },
      { id: 3, email: 'user2@alloweddomain2.com', isActive: true, groupIds: [2] },
      { id: 4, email: 'user3@notalloweddomain.com', isActive: true, groupIds: [3] }
    ]

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] },
      { id: 2, permissions: ['read:pages'], rules: [] },
      { id: 3, permissions: [], rules: [] }
    ]

    WIKI.config.mail.allowedDomains = 'alloweddomain1.com,alloweddomain2.com'

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Updated' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(1)
    expect(WIKI.mail.send).toHaveBeenCalledWith({
      template: 'page-notify',
      to: '',
      bcc: ['user1@alloweddomain1.com', 'user2@alloweddomain2.com'],
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        isDeletion: false,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        event: event,
        eventText: 'updated'
      }
    })
  })

  it('should allow all domains if allowedDomains is empty', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = 'test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const userIds = [2, 3, 4]
    const event = 'UPDATE_PAGE'

    const users = [
      { id: 2, email: 'user1@alloweddomain1.com', isActive: true, groupIds: [1] },
      { id: 3, email: 'user2@alloweddomain2.com', isActive: true, groupIds: [2] },
      { id: 4, email: 'user3@notalloweddomain.com', isActive: true, groupIds: [3] }
    ]

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] },
      { id: 2, permissions: ['read:pages'], rules: [] },
      { id: 3, permissions: ['read:pages'], rules: [] }
    ]

    WIKI.config.mail.allowedDomains = ''

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(users)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, userIds, event, subjectText: 'Page Updated' })

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', userIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(1)
    expect(WIKI.mail.send).toHaveBeenCalledWith({
      template: 'page-notify',
      to: '',
      bcc: ['user1@alloweddomain1.com', 'user2@alloweddomain2.com', 'user3@notalloweddomain.com'],
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}/${pagePath}`,
        isDeletion: false,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        event: event,
        eventText: 'updated'
      }
    })
  })
})
