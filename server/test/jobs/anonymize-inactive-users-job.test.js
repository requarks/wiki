const runAnonymizationJob = require('../../jobs/anonymize-inactive-users-job')
const { renderMentionedPages, anonymizeComments } = require('../../graph/services/userService')

const WIKI = {
  models: {
    userSiteInactivity: {
      query: jest.fn()
    },
    users: {
      query: jest.fn()
    },
    pages: {
      query: jest.fn()
    },
    pageHistory: {
      query: jest.fn()
    },
    comments: {
      query: jest.fn()
    },
    userMentions: {
      getMentionedPages: jest.fn(),
      getMentionedComments: jest.fn()
    }
  }
}

jest.mock('../../graph/services/userService', () => ({
  renderMentionedPages: jest.fn(),
  anonymizeComments: jest.fn()
}))

describe('anonymize-inactive-users-job', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should anonymize pages, comments, and mentions for inactive users', async () => {
    // Arrange
    const inactiveEntries = [{ userId: 42, siteId: 'siteA' }]
    const anonymousUser = { id: 999 }
    const user = { id: 42 }
    const mentionedPages = [{ id: 1 }]
    const mentionedComments = [{ id: 2 }]
    const userComments = [{ id: 3 }]

    WIKI.models.userSiteInactivity.query.mockReturnValue({
      where: jest.fn().mockResolvedValue(inactiveEntries),
      delete: jest.fn().mockReturnThis()
    })
    WIKI.models.users.query.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(anonymousUser),
      findById: jest.fn().mockResolvedValue(user)
    })
    WIKI.models.pages.query.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      patch: jest.fn().mockResolvedValue(1)
    })
    WIKI.models.pageHistory.query.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      patch: jest.fn().mockResolvedValue(1)
    })
    WIKI.models.comments.query
      .mockReturnValueOnce({
        where: jest.fn().mockResolvedValue(userComments)
      })
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        patch: jest.fn().mockResolvedValue(1)
      })

    WIKI.models.userMentions.getMentionedPages.mockResolvedValue(mentionedPages)
    WIKI.models.userMentions.getMentionedComments.mockResolvedValue(mentionedComments)
    // Simulate user is NOT reactivated
    const userSiteInactivityService = require('../../graph/services/userSiteInactivityService')
    userSiteInactivityService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(false)

    // Act
    await runAnonymizationJob()

    // Assert
    expect(WIKI.models.pages.query).toHaveBeenCalled()
    expect(WIKI.models.comments.query).toHaveBeenCalled()
    expect(WIKI.models.userMentions.getMentionedPages).toHaveBeenCalledWith(42)
    expect(WIKI.models.userMentions.getMentionedComments).toHaveBeenCalledWith(42)
    expect(renderMentionedPages).toHaveBeenCalledWith(mentionedPages)
    expect(anonymizeComments).toHaveBeenCalledWith(
      user,
      mentionedComments,
      userComments
    )
    // Check that inactivity entry is deleted
    expect(WIKI.models.userSiteInactivity.query().delete).toHaveBeenCalled()
  })

  it('should create the anonymous user if not found', async () => {
    // Arrange
    const inactiveEntries = [{ userId: 42, siteId: 'siteA' }]
    const anonymousUser = { id: 999 }
    const insertMock = jest.fn().mockResolvedValue(anonymousUser)
    const user = { id: 42 }

    WIKI.models.userSiteInactivity.query.mockReturnValue({
      where: jest.fn().mockResolvedValue(inactiveEntries),
      delete: jest.fn().mockReturnThis()
    })
    // First call returns null, second call returns the created user
    WIKI.models.users.query
      .mockReturnValueOnce({ findOne: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ insert: insertMock })
      .mockReturnValueOnce({ findById: jest.fn().mockResolvedValue(user) })
      .mockReturnValue({ findOne: jest.fn().mockResolvedValue(anonymousUser) })
    WIKI.models.pages.query.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      patch: jest.fn().mockResolvedValue(1)
    })
    WIKI.models.pageHistory.query.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      patch: jest.fn().mockResolvedValue(1)
    })
    WIKI.models.comments.query
      .mockReturnValueOnce({
        where: jest.fn().mockResolvedValue([])
      })
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        patch: jest.fn().mockResolvedValue(1)
      })
    WIKI.models.userMentions.getMentionedPages.mockResolvedValue([])
    WIKI.models.userMentions.getMentionedComments.mockResolvedValue([])
    // Simulate user is NOT reactivated
    const userSiteInactivityService = require('../../graph/services/userSiteInactivityService')
    userSiteInactivityService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(false)

    // Act
    await runAnonymizationJob()

    // Assert
    expect(WIKI.models.users.query).toHaveBeenCalled()
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'anonymous@user.com'
    }))
    expect(WIKI.models.userSiteInactivity.query().delete).toHaveBeenCalled()
  })

  it('should do nothing if there are no inactive users', async () => {
    // Arrange
    const anonymousUser = { id: 999 }
    WIKI.models.users.query.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(anonymousUser)
    })
    WIKI.models.userSiteInactivity.query.mockReturnValue({
      where: jest.fn().mockResolvedValue([])
    })
    // Simulate user is NOT reactivated
    const userSiteInactivityService = require('../../graph/services/userSiteInactivityService')
    userSiteInactivityService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(false)

    // Act
    await runAnonymizationJob()

    // Assert
    expect(WIKI.models.pages.query).not.toHaveBeenCalled()
    expect(WIKI.models.comments.query).not.toHaveBeenCalled()
    expect(renderMentionedPages).not.toHaveBeenCalled()
    expect(anonymizeComments).not.toHaveBeenCalled()
  })
  it('should skip anonymization if user was reactivated', async () => {
    // Arrange
    const inactiveEntries = [{ userId: 42, siteId: 'siteA' }]
    const anonymousUser = { id: 999 }
    WIKI.models.userSiteInactivity.query.mockReturnValue({
      where: jest.fn().mockResolvedValue(inactiveEntries)
    })
    WIKI.models.users.query.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(anonymousUser)
    })
    // Simulate user IS reactivated
    const userSiteInactivityService = require('../../graph/services/userSiteInactivityService')
    userSiteInactivityService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(true)

    // Act
    await runAnonymizationJob()

    // Assert
    expect(WIKI.models.pages.query).not.toHaveBeenCalled()
    expect(WIKI.models.comments.query).not.toHaveBeenCalled()
    expect(renderMentionedPages).not.toHaveBeenCalled()
    expect(anonymizeComments).not.toHaveBeenCalled()
  })
})
