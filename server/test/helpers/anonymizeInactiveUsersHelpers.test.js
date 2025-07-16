const helpers = require('../../helpers/anonymizeInactiveUsersHelpers')

const WIKI = {
  models: {
    users: { query: jest.fn() },
    pages: { query: jest.fn() },
    comments: { query: jest.fn() },
    assets: { query: jest.fn() },
    pageHistory: { query: jest.fn(), anonymizeMentionsByPageIds: jest.fn() },
    userMentions: {
      getMentionedPages: jest.fn(),
      getMentionedComments: jest.fn(),
      query: jest.fn()
    },
    userSiteInactivity: { query: jest.fn() }
  }
}

describe('anonymizeInactiveUsersHelpers', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('userWasReactivated', () => {
    it('should return true if user was reactivated', async () => {
      const mockService = require('../../graph/services/userSiteInactivityService')
      mockService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(true)

      const result = await helpers.userWasReactivated(42)

      expect(result).toBe(true)
    })
    it('should return false if user was not reactivated', async () => {
      const mockService = require('../../graph/services/userSiteInactivityService')
      mockService.removedUserSiteInactivityIfReactivated = jest.fn().mockResolvedValue(false)

      const result = await helpers.userWasReactivated(42)

      expect(result).toBe(false)
    })
  })

  describe('getUser', () => {
    it('should fetch user by id', async () => {
      const user = { id: 1 }
      WIKI.models.users.query.mockReturnValue({ findById: jest.fn().mockResolvedValue(user) })

      const result = await helpers.getUser(1)

      expect(result).toBe(user)
    })
  })

  describe('getSitePageIds', () => {
    it('should return page ids for a site', async () => {
      WIKI.models.pages.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
      })

      const ids = await helpers.getSitePageIds('siteA')

      expect(ids).toEqual([1, 2])
    })
  })

  describe('getMentionedPagesOfSite', () => {
    it('should filter mentioned pages by site page ids', async () => {
      WIKI.models.userMentions.getMentionedPages.mockResolvedValue([
        { pageId: 1 }, { pageId: 2 }, { pageId: 3 }
      ])

      const result = await helpers.getMentionedPagesOfSite(42, [1, 3, 4])

      expect(result).toEqual([{ pageId: 1 }, { pageId: 3 }])
    })
  })

  describe('getMentionedCommentsOfSite', () => {
    it('should filter mentioned comments by site page ids', async () => {
      WIKI.models.userMentions.getMentionedComments.mockResolvedValue([
        { pageId: 1 }, { pageId: 2 }
      ])

      const result = await helpers.getMentionedCommentsOfSite(42, [2, 3])

      expect(result).toEqual([{ pageId: 2 }])
    })
  })

  describe('getUserCommentsOfSite', () => {
    it('should filter user comments by site page ids', async () => {
      WIKI.models.comments.query.mockReturnValue({
        where: jest.fn().mockResolvedValue([
          { pageId: 1 }, { pageId: 2 }
        ])
      })

      const result = await helpers.getUserCommentsOfSite(42, [2, 3])

      expect(result).toEqual([{ pageId: 2 }])
    })
  })

  describe('anonymizeAssets', () => {
    it('should patch assets for the user and site', async () => {
      const patch = jest.fn()
      const where = jest.fn(() => ({ patch }))
      WIKI.models.assets.query.mockReturnValue({ where })

      await helpers.anonymizeAssets({ userId: 42, siteId: 'siteA' }, { id: 999 })

      expect(where).toHaveBeenCalledWith({ authorId: 42, siteId: 'siteA' })
      expect(patch).toHaveBeenCalledWith({ authorId: 999 })
    })
  })

  describe('anonymizePageHistory', () => {
    it('should patch page history and anonymize mentions', async () => {
      const patch = jest.fn()
      const where = jest.fn(() => ({ patch }))
      WIKI.models.pageHistory.query.mockReturnValue({ where, patch })
      helpers.getSitePageIds = jest.fn().mockResolvedValue([1, 2])
      WIKI.models.pageHistory.anonymizeMentionsByPageIds = jest.fn()
      const user = { email: 'test@example.com' }

      await helpers.anonymizePageHistory({ userId: 42, siteId: 'siteA' }, { id: 999 }, user)

      expect(where).toHaveBeenCalledWith({ authorId: 42, siteId: 'siteA' })
      expect(patch).toHaveBeenCalledWith({ authorId: 999 })
      expect(WIKI.models.pageHistory.anonymizeMentionsByPageIds).toHaveBeenCalledWith(
        [1, 2],
        expect.any(Function),
        user.email
      )
    })
  })

  describe('anonymizePages', () => {
    it('should patch authorId and creatorId for pages', async () => {
      const patch = jest.fn()
      const where = jest.fn(() => ({ patch }))
      WIKI.models.pages.query.mockReturnValue({ where, patch })

      await helpers.anonymizePages({ userId: 42, siteId: 'siteA' }, { id: 999 })

      expect(where).toHaveBeenCalledWith({ authorId: 42, siteId: 'siteA' })
      expect(patch).toHaveBeenCalledWith({ authorId: 999 })
      expect(where).toHaveBeenCalledWith({ creatorId: 42, siteId: 'siteA' })
      expect(patch).toHaveBeenCalledWith({ creatorId: 999 })
    })
  })

  describe('removeInactivityEntry', () => {
    it('should delete the inactivity entry', async () => {
      const deleteMock = jest.fn(() => ({ where: jest.fn() }))
      WIKI.models.userSiteInactivity.query.mockReturnValue({ delete: deleteMock })

      await helpers.removeInactivityEntry({ userId: 42, siteId: 'siteA' })

      expect(deleteMock).toHaveBeenCalled()
    })
  })

  describe('removeUserMentions', () => {
    it('should delete user mentions for each mentioned page', async () => {
      const deleteMock = jest.fn(() => ({ where: jest.fn() }))
      WIKI.models.userMentions.query.mockReturnValue({ delete: deleteMock })

      await helpers.removeUserMentions([{ pageId: 1 }, { pageId: 2 }], 42)

      expect(deleteMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('getInactiveForThresholdOrMore', () => {
    it('should return inactive entries before threshold', async () => {
      const inactiveEntries = [{ userId: 1 }]
      WIKI.models.userSiteInactivity.query.mockReturnValue({
        where: jest.fn().mockResolvedValue(inactiveEntries)
      })

      const result = await helpers.getInactiveForThresholdOrMore()

      expect(result).toBe(inactiveEntries)
    })
  })

  describe('retrieveOrCreateAnonymousUser', () => {
    const anonymousUser = { id: 999 }
    it('should return existing anonymous user', async () => {
      WIKI.models.users.query.mockReturnValue({ findOne: jest.fn().mockResolvedValue(anonymousUser) })

      const result = await helpers.retrieveOrCreateAnonymousUser()

      expect(result).toBe(anonymousUser)
    })
    it('should create anonymous user if not found', async () => {
      WIKI.models.users.query
        .mockReturnValueOnce({ findOne: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ insert: jest.fn().mockResolvedValue(anonymousUser) })

      const result = await helpers.retrieveOrCreateAnonymousUser()

      expect(result).toBe(anonymousUser)
    })
  })
})
