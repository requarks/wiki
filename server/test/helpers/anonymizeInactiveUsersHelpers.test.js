const helpers = require('../../helpers/anonymizeInactiveUsersHelpers')

const WIKI = {
  models: {
    users: { query: jest.fn() },
    pages: { query: jest.fn(), deletePageFromCache: jest.fn(), anonymizeMentionsByPageIds: jest.fn() },
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
// Provide logger mock used in helper
WIKI.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

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
    it('should patch authorId and creatorId, anonymize mentions, and invalidate cache', async () => {
      // Arrange mocks for the sequential query() calls in anonymizePages
      const affectedPages = [{ hash: 'hash1' }, { hash: 'hash2' }]

      // First query: builder pattern returning pages with hashes
      const builderStub = {
        where: jest.fn(function () { return builderStub }),
        orWhere: jest.fn(function () { return builderStub }),
        select: jest.fn(() => Promise.resolve(affectedPages))
      }
      const firstQuery = { where: jest.fn(fn => { fn(builderStub); return builderStub }) }

      // Second query: patch authorId
      const patchAuthor = jest.fn()
      const secondQuery = { where: jest.fn(() => ({ patch: patchAuthor })) }

      // Third query: patch creatorId
      const patchCreator = jest.fn()
      const thirdQuery = { where: jest.fn(() => ({ patch: patchCreator })) }

      // Mock getSitePageIds
      const sitePageIds = [1, 2, 3]
      const selectMock = jest.fn(() => Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }]))
      const whereForPages = jest.fn(() => ({ select: selectMock }))
      const fourthQuery = { where: whereForPages }

      // Stub deletePageFromCache + events emitter
      WIKI.models.pages.deletePageFromCache = jest.fn()
      WIKI.models.pages.anonymizeMentionsByPageIds = jest.fn()
      WIKI.events = { outbound: { emit: jest.fn() } }

      // Chain the mock returns for successive calls to WIKI.models.pages.query()
      WIKI.models.pages.query
        .mockReturnValueOnce(firstQuery)
        .mockReturnValueOnce(secondQuery)
        .mockReturnValueOnce(thirdQuery)
        .mockReturnValueOnce(fourthQuery)

      const user = { email: 'test@example.com' }

      // Act
      await helpers.anonymizePages({ userId: 42, siteId: 'siteA' }, { id: 999 }, user)

      // Assert author patch
      expect(secondQuery.where).toHaveBeenCalledWith({ authorId: 42, siteId: 'siteA' })
      expect(patchAuthor).toHaveBeenCalledWith({ authorId: 999 })
      // Assert creator patch
      expect(thirdQuery.where).toHaveBeenCalledWith({ creatorId: 42, siteId: 'siteA' })
      expect(patchCreator).toHaveBeenCalledWith({ creatorId: 999 })
      // Assert getSitePageIds was called
      expect(whereForPages).toHaveBeenCalledWith({ siteId: 'siteA' })
      expect(selectMock).toHaveBeenCalledWith('id')
      // Assert anonymizeMentionsByPageIds was called
      expect(WIKI.models.pages.anonymizeMentionsByPageIds).toHaveBeenCalledWith(
        sitePageIds,
        expect.any(Function),
        user.email
      )
      // Cache invalidation + outbound events
      expect(WIKI.models.pages.deletePageFromCache).toHaveBeenCalledTimes(2)
      expect(WIKI.models.pages.deletePageFromCache).toHaveBeenCalledWith('hash1')
      expect(WIKI.models.pages.deletePageFromCache).toHaveBeenCalledWith('hash2')
      expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('deletePageFromCache', 'hash1')
      expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('deletePageFromCache', 'hash2')
    })

    it('should not attempt cache invalidation or events when no pages are affected', async () => {
      // First query returns empty array
      const builderStub = {
        where: jest.fn(function () { return builderStub }),
        orWhere: jest.fn(function () { return builderStub }),
        select: jest.fn(() => Promise.resolve([]))
      }
      const firstQuery = { where: jest.fn(fn => { fn(builderStub); return builderStub }) }

      // Author + creator patch queries (still perform updates)
      const patchAuthor = jest.fn()
      const secondQuery = { where: jest.fn(() => ({ patch: patchAuthor })) }
      const patchCreator = jest.fn()
      const thirdQuery = { where: jest.fn(() => ({ patch: patchCreator })) }

      // Mock getSitePageIds
      const selectMock = jest.fn(() => Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }]))
      const whereForPages = jest.fn(() => ({ select: selectMock }))
      const fourthQuery = { where: whereForPages }

      WIKI.models.pages.deletePageFromCache = jest.fn()
      WIKI.models.pages.anonymizeMentionsByPageIds = jest.fn()
      WIKI.events = { outbound: { emit: jest.fn() } }

      WIKI.models.pages.query
        .mockReturnValueOnce(firstQuery)
        .mockReturnValueOnce(secondQuery)
        .mockReturnValueOnce(thirdQuery)
        .mockReturnValueOnce(fourthQuery)

      const user = { email: 'test@example.com' }

      await helpers.anonymizePages({ userId: 42, siteId: 'siteA' }, { id: 999 }, user)

      expect(secondQuery.where).toHaveBeenCalledWith({ authorId: 42, siteId: 'siteA' })
      expect(patchAuthor).toHaveBeenCalledWith({ authorId: 999 })
      expect(thirdQuery.where).toHaveBeenCalledWith({ creatorId: 42, siteId: 'siteA' })
      expect(patchCreator).toHaveBeenCalledWith({ creatorId: 999 })
      // anonymizeMentionsByPageIds should still be called
      expect(WIKI.models.pages.anonymizeMentionsByPageIds).toHaveBeenCalled()
      // No cache invalidation or events for affected pages (since there were none)
      expect(WIKI.models.pages.deletePageFromCache).not.toHaveBeenCalled()
      expect(WIKI.events.outbound.emit).not.toHaveBeenCalled()
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
