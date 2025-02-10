const notifyUsers = require('../../jobs/notify-users')

const WIKI = {
  auth: {
    checkAccess: jest.fn()
  },
  mail: {
    send: jest.fn()
  },
  models: {
    followers: {
      query: jest.fn()
    },
    users: {
      query: jest.fn()
    },
    groups: {
      query: jest.fn()
    }
  },
  config: {
    host: 'https://example.com'
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
    const followerIds = [2, 3, 4]
    const event = 'UPDATE_PAGE'

    const followers = [
      { id: 2, email: 'follower1@example.com', isActive: true, groupIds: [1] },
      { id: 3, email: 'follower2@example.com', isActive: true, groupIds: [2] },
      { id: 4, email: 'follower3@example.com', isActive: false, groupIds: [3] }
    ]

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] },
      { id: 2, permissions: ['read:pages'], rules: [] },
      { id: 3, permissions: [], rules: [] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(followers)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({siteId, pageId, pageTitle, pagePath, sitePath, userEmail, followerIds, event})

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', followerIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(1)
    expect(WIKI.mail.send).toHaveBeenCalledWith({
      template: 'page-notify',
      to: '',
      bcc: ['follower1@example.com', 'follower2@example.com'],
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      text: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}`,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        eventText: 'updated'
      }
    })
  })

  it('should notify users with read access in batches', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = '/test-page'
    const sitePath = '/test-site'
    const userEmail = 'user@example.com'
    const followerIds = Array.from({ length: 25 }, (_, i) => i + 1) // Generate 25 follower IDs
    const event = 'UPDATE_PAGE'

    const followers = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      email: `follower${i + 1}@example.com`,
      isActive: true,
      groupIds: [1]
    }))

    const groups = [
      { id: 1, permissions: ['read:pages'], rules: [] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(followers)
    })

    WIKI.auth.checkAccess.mockImplementation((user, permissions, page) => {
      return user.groupIds.some(groupId => {
        const group = groups.find(g => g.id === groupId)
        return group && group.permissions.includes('read:pages')
      })
    })

    WIKI.mail.send.mockResolvedValue(true)

    await notifyUsers({siteId, pageId, pageTitle, pagePath, sitePath, userEmail, followerIds, event})

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', followerIds)
    expect(WIKI.mail.send).toHaveBeenCalledTimes(3) // Expect 3 batches of emails
    expect(WIKI.mail.send).toHaveBeenNthCalledWith(1, {
      template: 'page-notify',
      to: '',
      bcc: followers.slice(0, 10).map(f => f.email),
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      text: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}`,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        eventText: 'updated'
      }
    })
    expect(WIKI.mail.send).toHaveBeenNthCalledWith(2, {
      template: 'page-notify',
      to: '',
      bcc: followers.slice(10, 20).map(f => f.email),
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      text: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}`,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        eventText: 'updated'
      }
    })
    expect(WIKI.mail.send).toHaveBeenNthCalledWith(3, {
      template: 'page-notify',
      to: '',
      bcc: followers.slice(20, 25).map(f => f.email),
      subject: `[Page Notification] Page Updated: ${pageTitle}`,
      text: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
      data: {
        pageUrl: `${WIKI.config.host}/${sitePath}`,
        preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        pageTitle: pageTitle,
        userEmail: userEmail,
        eventText: 'updated'
      }
    })
  })

  it('should not notify inactive users', async () => {
    const siteId = 1
    const pageId = 1
    const pageTitle = 'Test Page'
    const pagePath = '/test-page'
    const sitePath = 'test-site'
    const userEmail = 'user@example.com'
    const followerIds = [2, 3, 4]
    const event = 'UPDATE_PAGE'

    const followers = [
      { id: 2, email: 'follower1@example.com', isActive: false, groupIds: [1] },
      { id: 3, email: 'follower2@example.com', isActive: false, groupIds: [2] },
      { id: 4, email: 'follower3@example.com', isActive: false, groupIds: [3] }
    ]

    WIKI.models.users.query.mockReturnValue({
      whereIn: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      modifyGraph: jest.fn().mockResolvedValue(followers)
    })

    await notifyUsers({siteId, pageId, pageTitle, pagePath, sitePath, userEmail, followerIds, event})

    expect(WIKI.models.users.query().whereIn).toHaveBeenCalledWith('id', followerIds)
    expect(WIKI.auth.checkAccess).not.toHaveBeenCalled()
    expect(WIKI.mail.send).not.toHaveBeenCalled()
  })
})
