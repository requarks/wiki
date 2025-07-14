const runAnonymizationJob = require('../../jobs/anonymize-inactive-users-job')
const { anonymizeComments, renderMentionedPagesWithoutScheduler } = require('../../graph/services/userService')

const WIKI = {
  models: {
    userSiteInactivity: { query: jest.fn() },
    users: { query: jest.fn() },
    pages: { query: jest.fn() },
    pageHistory: { query: jest.fn() },
    comments: { query: jest.fn() },
    assets: { query: jest.fn() },
    userMentions: {
      getMentionedPagesBySiteId: jest.fn(),
      getMentionedCommentsBySiteId: jest.fn()
    },
    knex: {
      destroy: jest.fn()
    }
  },
  data: {
    commentProviders: {
      initProvider: jest.fn(() => ({
        getProvider: jest.fn()
      }))
    }
  },
  configSvc: {
    loadFromDb: jest.fn().mockResolvedValue(),
    applyFlags: jest.fn().mockResolvedValue()
  }
}

jest.mock('../../graph/services/userService', () => ({
  renderMentionedPagesWithoutScheduler: jest.fn(),
  anonymizeComments: jest.fn()
}))

jest.mock('../../helpers/dateHelpers', () => {
  const INACTIVITY_DAYS_THRESHOLD = 90
  return {
    INACTIVITY_DAYS_THRESHOLD,
    inactivityThresholdISOString: jest.fn(() =>
      new Date(Date.now() - 1000 * 60 * 60 * 24 * INACTIVITY_DAYS_THRESHOLD).toISOString()
    )
  }
})

jest.mock('../../core/db', () => ({
  init: jest.fn(() => global.WIKI?.models || {})
}))
jest.mock('../../models/commentProviders', () => ({
  initProvider: jest.fn(() => global.WIKI?.data?.commentProviders || {})
}))

describe('anonymize-inactive-users-job', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should anonymize only the user data for the specified site', async () => {
    // Arrange
    const inactiveEntries = [{ userId: 42, siteId: 'siteA' }]
    const anonymousUser = { id: 999 }
    const user = { id: 42 }
    const mentionedPages = [{ pageId: 1 }]
    const mentionedComments = [{ pageId: 1 }]
    const userComments = [{ pageId: 1, id: 3 }]

    // Mock userSiteInactivity
    const mockUserSiteInactivityWhere = jest.fn().mockResolvedValue(inactiveEntries)
    const mockUserSiteInactivityDelete = jest.fn().mockReturnThis()
    WIKI.models.userSiteInactivity.query.mockReturnValue({
      where: mockUserSiteInactivityWhere,
      delete: mockUserSiteInactivityDelete
    })

    WIKI.models.users.query.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(anonymousUser),
      findById: jest.fn().mockResolvedValue(user)
    })

    const mockPagesWhere = jest.fn().mockReturnThis()
    const mockPagesPatch = jest.fn().mockResolvedValue(1)
    WIKI.models.pages.query.mockReturnValue({
      where: mockPagesWhere,
      select: jest.fn().mockReturnValue([{ id: 1 }]),
      patch: mockPagesPatch
    })

    const mockPageHistoryWhere = jest.fn().mockReturnThis()
    const mockPageHistoryPatch = jest.fn().mockResolvedValue(1)
    WIKI.models.pageHistory.query.mockReturnValue({
      where: mockPageHistoryWhere,
      delete: jest.fn().mockReturnThis(),
      patch: mockPageHistoryPatch
    })

    const mockCommentsWhere = jest.fn().mockResolvedValue(userComments)
    const mockCommentsPatch = jest.fn().mockResolvedValue(1)
    WIKI.models.comments.query
      .mockReturnValueOnce({ where: mockCommentsWhere }) // for userComments
      .mockReturnValue({ where: jest.fn().mockReturnThis(), patch: mockCommentsPatch })

    const mockAssetsWhere = jest.fn().mockReturnThis()
    const mockAssetsPatch = jest.fn().mockResolvedValue(1)
    WIKI.models.assets.query.mockReturnValue({
      where: mockAssetsWhere,
      patch: mockAssetsPatch
    })

    // Use the old method names as in the job
    WIKI.models.userMentions.getMentionedPages = jest.fn().mockResolvedValue(mentionedPages)
    WIKI.models.userMentions.getMentionedComments = jest.fn().mockResolvedValue(mentionedComments)

    // Simulate user is NOT reactivated
    const userSiteInactivityService = require('../../graph/services/userSiteInactivityService')
    userSiteInactivityService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(false)

    // Act
    await runAnonymizationJob()

    // Assert: All queries should be called with the correct siteId
    expect(mockPagesWhere).toHaveBeenCalledWith({ siteId: 'siteA' })
    expect(mockPagesPatch).toHaveBeenCalled()
    expect(mockPageHistoryWhere).toHaveBeenCalledWith({ authorId: 42, siteId: 'siteA' })
    expect(mockCommentsWhere).toHaveBeenCalledWith({ authorId: 42 })
    expect(mockAssetsWhere).toHaveBeenCalledWith({ authorId: 42, siteId: 'siteA' })
    expect(WIKI.models.userMentions.getMentionedPages).toHaveBeenCalledWith(42)
    expect(WIKI.models.userMentions.getMentionedComments).toHaveBeenCalledWith(42)
    expect(renderMentionedPagesWithoutScheduler).toHaveBeenCalledWith(mentionedPages)
    expect(anonymizeComments).toHaveBeenCalledWith(
      user,
      mentionedComments,
      userComments
    )
    expect(mockUserSiteInactivityDelete).toHaveBeenCalled()
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

    // First call to findOne returns null (not found), second call to insert creates user,
    // third call to findById returns the user to be anonymized
    let callCount = 0
    WIKI.models.users.query.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return { findOne: jest.fn().mockResolvedValue(null) }
      }
      if (callCount === 2) {
        return { insert: insertMock }
      }
      if (callCount === 3) {
        return { findById: jest.fn().mockResolvedValue(user) }
      }
      return { findOne: jest.fn().mockResolvedValue(anonymousUser) }
    })

    WIKI.models.pages.query.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnValue([{ id: 1 }]),
      patch: jest.fn().mockResolvedValue(1)
    })
    WIKI.models.pageHistory.query.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      patch: jest.fn().mockResolvedValue(1)
    })
    WIKI.models.comments.query
      .mockReturnValueOnce({
        where: jest.fn().mockResolvedValue([])
      })
      .mockReturnValue({
        where: jest.fn().mockReturnThis(),
        patch: jest.fn().mockResolvedValue(1)
      })
    WIKI.models.assets.query.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      patch: jest.fn().mockResolvedValue(1)
    })
    WIKI.models.userMentions.getMentionedPages = jest.fn().mockResolvedValue([])
    WIKI.models.userMentions.getMentionedComments = jest.fn().mockResolvedValue([])

    // Simulate user is NOT reactivated
    const userSiteInactivityService = require('../../graph/services/userSiteInactivityService')
    userSiteInactivityService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(false)

    // Act
    await runAnonymizationJob()

    // Assert
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
    expect(renderMentionedPagesWithoutScheduler).not.toHaveBeenCalled()
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
    expect(renderMentionedPagesWithoutScheduler).not.toHaveBeenCalled()
    expect(anonymizeComments).not.toHaveBeenCalled()
  })
})
