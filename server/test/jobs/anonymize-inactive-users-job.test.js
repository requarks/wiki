const runAnonymizationJob = require('../../jobs/anonymize-inactive-users-job')

jest.mock('../../helpers/anonymizeInactiveUsersHelpers', () => ({
  getUser: jest.fn(),
  getSitePageIds: jest.fn(),
  getMentionedPagesOfSite: jest.fn(),
  getMentionedCommentsOfSite: jest.fn(),
  getUserCommentsOfSite: jest.fn(),
  userWasReactivated: jest.fn(),
  anonymizeAssets: jest.fn(),
  anonymizePageHistory: jest.fn(),
  anonymizePages: jest.fn(),
  removeInactivityEntry: jest.fn(),
  removeUserMentions: jest.fn(),
  getInactiveForThresholdOrMore: jest.fn(),
  retrieveOrCreateAnonymousUser: jest.fn()
}))
jest.mock('../../graph/services/userService', () => ({
  renderMentionedPagesWithoutScheduler: jest.fn(),
  anonymizeComments: jest.fn()
}))
jest.mock('../../core/db', () => ({
  init: jest.fn(() => global.WIKI?.models || {})
}))
jest.mock('../../models/commentProviders', () => ({
  initProvider: jest.fn(() => global.WIKI?.data?.commentProviders || {})
}))

const helpers = require('../../helpers/anonymizeInactiveUsersHelpers')
const userService = require('../../graph/services/userService')

const WIKI = {
  models: {
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

describe('runAnonymizationJob', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  it('should do nothing if user was reactivated', async () => {
    const inactivityEntry = { userId: 1, siteId: 'siteA' }
    helpers.getInactiveForThresholdOrMore.mockResolvedValue([inactivityEntry])
    helpers.retrieveOrCreateAnonymousUser.mockResolvedValue({ id: 999 })
    helpers.userWasReactivated.mockResolvedValue(true)

    await runAnonymizationJob()

    expect(helpers.getUser).not.toHaveBeenCalled()
    expect(userService.renderMentionedPagesWithoutScheduler).not.toHaveBeenCalled()
  })

  it('should call all steps in order for a non-reactivated user', async () => {
    // Arrange
    const inactivityEntry = { userId: 1, siteId: 'siteA' }
    const anonymousUser = { id: 999 }
    helpers.getInactiveForThresholdOrMore.mockResolvedValue([inactivityEntry])
    helpers.retrieveOrCreateAnonymousUser.mockResolvedValue(anonymousUser)
    helpers.userWasReactivated.mockResolvedValue(false)
    helpers.getUser.mockResolvedValue({ id: 1, email: 'test@example.com' })
    helpers.getSitePageIds.mockResolvedValue([1, 2])
    helpers.getMentionedPagesOfSite.mockResolvedValue([{ pageId: 1 }])
    helpers.getMentionedCommentsOfSite.mockResolvedValue([{ pageId: 1 }])
    helpers.getUserCommentsOfSite.mockResolvedValue([{ pageId: 1 }])

    // Act
    await runAnonymizationJob()

    // Assert
    expect(helpers.getUser).toHaveBeenCalledWith(1)
    expect(helpers.getSitePageIds).toHaveBeenCalledWith('siteA')
    expect(helpers.getMentionedPagesOfSite).toHaveBeenCalledWith(1, [1, 2])
    expect(helpers.getMentionedCommentsOfSite).toHaveBeenCalledWith(1, [1, 2])
    expect(helpers.getUserCommentsOfSite).toHaveBeenCalledWith(1, [1, 2])
    expect(userService.renderMentionedPagesWithoutScheduler).toHaveBeenCalledWith([{ pageId: 1 }])
    expect(helpers.anonymizeAssets).toHaveBeenCalledWith(inactivityEntry, anonymousUser)
    expect(userService.anonymizeComments).toHaveBeenCalledWith(
      { id: 1, email: 'test@example.com' },
      [{ pageId: 1 }],
      [{ pageId: 1 }],
      anonymousUser
    )
    expect(helpers.anonymizePageHistory).toHaveBeenCalledWith(
      inactivityEntry,
      anonymousUser,
      { id: 1, email: 'test@example.com' }
    )
    expect(helpers.anonymizePages).toHaveBeenCalledWith(inactivityEntry, anonymousUser)
    expect(helpers.removeInactivityEntry).toHaveBeenCalledWith(inactivityEntry)
    expect(helpers.removeUserMentions).toHaveBeenCalledWith([{ pageId: 1 }], 1)
  })
})
