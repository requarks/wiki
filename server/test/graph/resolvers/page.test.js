const { PageMutation, Query } = require('../../../graph/resolvers/page')
const graphHelper = require('../../../helpers/graph')
const notifyUsers = require('../../../jobs/notify-users')

jest.mock('../../../helpers/graph', () => ({
  generateError: jest.fn(),
  generateSuccess: jest.fn()
}))
jest.mock('../../../jobs/notify-users')

const WIKI = {
  models: {
    followers: {
      query: jest.fn()
    },
    pages: {
      createPage: jest.fn(),
      updatePage: jest.fn(),
      query: jest.fn(),
      deletePage: jest.fn()
    },
    users: {
      query: jest.fn()
    },
    knex: jest.fn()
  },
  auth: {
    checkAccess: jest.fn()
  },
  config: {
    lang: 'en'
  },
  Error: {
    PageViewForbidden: class extends Error {},
    PageNotFound: class extends Error {}
  }
}

describe('Page Resolvers -> Query', () => {
  const mockChildPagesQuery = function(pRow, cRows) {
    return jest.fn()
      // first('id').where('pageId', args.pageId)
      .mockImplementationOnce(() => ({
        first: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(pRow)
        })
      }))
      // .where(...).orderBy(...)
      .mockImplementationOnce(() => ({
        where: jest.fn((cb) => {
          const builder = {
            where: jest.fn()
          }
          cb(builder)
          return {
            orderBy: jest.fn().mockResolvedValue(cRows)
          }
        })
      }))
  }

  describe('childPages', () => {
    let req, args, context, parentRow, childRows

    beforeEach(() => {
      req = {
        user: { id: 1 }
      }
      global.WIKI = WIKI

      args = { pageId: 10, locale: 'en', siteId: 1 }
      context = { req, WIKI }

      parentRow = { id: 99 }
      childRows = [
        { id: 1, parent: 99, path: '/foo', localeCode: 'en', siteId: 1, isFolder: true, title: 'A' },
        { id: 2, parent: 99, path: '/bar', localeCode: 'en', siteId: 1, isFolder: false, title: 'B' }
      ]
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return child pages with correct parent and locale', async () => {
      // GIVEN
      WIKI.models.knex = mockChildPagesQuery(parentRow, childRows)
      WIKI.auth.checkAccess.mockReturnValue(true)

      // WHEN
      const result = await Query.childPages(null, args, context)

      // THEN
      expect(WIKI.models.knex).toHaveBeenCalledTimes(2)
      expect(result).toEqual([
        { ...childRows[0], parent: 99, locale: 'en' },
        { ...childRows[1], parent: 99, locale: 'en' }
      ])
    })

    it('should set parent to 0 if parent is not a number', async () => {
      // GIVEN
      childRows[0] = {
        parent: null, // relevant change for this test
        id: 1,
        path: '/foo',
        localeCode: 'en',
        siteId: 1,
        isFolder: true,
        title: 'A'
      }

      WIKI.models.knex = mockChildPagesQuery(parentRow, childRows)
      WIKI.auth.checkAccess.mockReturnValue(true)

      // WHEN
      const result = await Query.childPages(null, args, context)

      // THEN
      expect(result[0].parent).toBe(0)
    })

    it('should use default locale if not provided', async () => {
      // GIVEN
      args = {
        locale: undefined, // relevant change for this test
        pageId: 10,
        siteId: 1
      }

      WIKI.models.knex = mockChildPagesQuery(parentRow, childRows)
      WIKI.auth.checkAccess.mockReturnValue(true)

      // WHEN
      const result = await Query.childPages(null, args, context)

      // THEN
      expect(result[0].locale).toBe('en')
    })

    it('should return empty array if no parentRow and no children', async () => {
      // GIVEN
      WIKI.models.knex = mockChildPagesQuery(
        undefined, // parentRow not found
        [] //  no childRows
      )
      WIKI.auth.checkAccess.mockReturnValue(true)

      // WHEN
      const result = await Query.childPages(null, args, context)

      // THEN
      expect(result).toEqual([])
    })

    it('should filter out pages if checkAccess returns false', async () => {
      // GIVEN
      WIKI.models.knex = mockChildPagesQuery(parentRow, childRows)
      WIKI.auth.checkAccess
        .mockReturnValueOnce(true) // Only allow access to the first child
        .mockReturnValueOnce(false)

      // WHEN
      const result = await Query.childPages(null, args, context)

      // THEN
      expect(result.length).toBe(1)
      expect(result[0].id).toBe(1)
    })
  })
})

describe('Page Resolvers -> PageMutation', () => {
  let req

  beforeEach(() => {
    req = {
      user: { id: 1, email: 'user@example.com' },
      siteId: 'site-id'
    }
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create a page successfully and not notify followers when notifyFollowers is omitted', async () => {
      const args = {
        notifyFollowers: undefined,
        mentions: [],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.createPage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })

      WIKI.models.followers.query.mockReturnValue({
        insert: jest.fn().mockResolvedValue(),
        where: jest.fn().mockResolvedValue([]),
        orWhere: jest.fn().mockResolvedValue([])
      })

      const result = await PageMutation.create(null, args, context)

      expect(notifyUsers).not.toHaveBeenCalled()
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page created successfully.'))
    })

    it('should notify followers when notifyFollowers is true', async () => {
      const args = {
        notifyFollowers: true,
        mentions: [],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.createPage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })
      WIKI.models.followers.query.mockReturnValue({
        insert: jest.fn().mockResolvedValue(),
        where: jest.fn().mockResolvedValue([{ userId: 2 }]),
        orWhere: jest.fn().mockResolvedValue([{ userId: 2 }])
      })

      const result = await PageMutation.create(null, args, context)

      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [2],
        event: 'CREATE_PAGE',
        subjectText: 'Created Page'
      })
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page created successfully.'))
    })

    it('should notify mentioned users when mentions are provided', async () => {
      const args = {
        notifyFollowers: false,
        mentions: ['mention@example.com'],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.createPage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })
      WIKI.models.followers.query.mockReturnValue({
        insert: jest.fn().mockResolvedValue()
      })
      WIKI.models.users.query.mockReturnValue({
        whereIn: jest.fn().mockResolvedValue([{ id: 3 }])
      })

      const result = await PageMutation.create(null, args, context)

      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [3],
        event: 'MENTION_PAGE',
        subjectText: 'Mentioned in Page'
      })
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page created successfully.'))
    })

    it('should notify both followers and mentioned users', async () => {
      const args = {
        notifyFollowers: true,
        mentions: ['mention@example.com'],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.createPage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })
      WIKI.models.followers.query.mockReturnValue({
        insert: jest.fn().mockResolvedValue(),
        where: jest.fn().mockResolvedValue([{ userId: 2 }]),
        orWhere: jest.fn().mockResolvedValue([{ userId: 2 }])
      })
      WIKI.models.users.query.mockReturnValue({
        whereIn: jest.fn().mockResolvedValue([{ id: 3 }])
      })

      const result = await PageMutation.create(null, args, context)

      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [2],
        event: 'CREATE_PAGE',
        subjectText: 'Created Page'
      })
      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [3],
        event: 'MENTION_PAGE',
        subjectText: 'Mentioned in Page'
      })
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page created successfully.'))
    })
  })

  describe('update', () => {
    it('should update a page successfully and not notify followers when notifyFollowers is omitted', async () => {
      const args = {
        notifyFollowers: undefined,
        mentions: [],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.updatePage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockResolvedValue([])
      })

      const result = await PageMutation.update(null, args, context)

      expect(notifyUsers).not.toHaveBeenCalled()
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page has been updated.'))
    })

    it('should notify followers when notifyFollowers is true', async () => {
      const args = {
        notifyFollowers: true,
        mentions: [],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.updatePage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockResolvedValue([{ userId: 2 }])
      })

      const result = await PageMutation.update(null, args, context)

      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [2],
        event: 'UPDATE_PAGE',
        subjectText: 'Updated Page'
      })
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page has been updated.'))
    })

    it('should notify mentioned users when mentions are provided', async () => {
      const args = {
        notifyFollowers: false,
        mentions: ['mention@example.com'],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.updatePage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })
      WIKI.models.users.query.mockReturnValue({
        whereIn: jest.fn().mockResolvedValue([{ id: 3 }])
      })

      const result = await PageMutation.update(null, args, context)

      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [3],
        event: 'MENTION_PAGE',
        subjectText: 'Mentioned in Page'
      })
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page has been updated.'))
    })

    it('should notify both followers and mentioned users', async () => {
      const args = {
        notifyFollowers: true,
        mentions: ['mention@example.com'],
        siteId: 'site-id',
        title: 'Test Page',
        path: 'test-page',
        sitePath: 'site-path'
      }
      const context = { req, WIKI }

      WIKI.models.pages.updatePage.mockResolvedValue({
        id: 'page-id',
        siteId: args.siteId,
        title: args.title,
        path: args.path,
        sitePath: args.sitePath
      })
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockResolvedValue([{ userId: 2 }])
      })
      WIKI.models.users.query.mockReturnValue({
        whereIn: jest.fn().mockResolvedValue([{ id: 3 }])
      })

      const result = await PageMutation.update(null, args, context)

      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [2],
        event: 'UPDATE_PAGE',
        subjectText: 'Updated Page'
      })
      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: args.siteId,
        pageId: 'page-id',
        pageTitle: args.title,
        pagePath: args.path,
        sitePath: args.sitePath,
        userEmail: context.req.user.email,
        userIds: [3],
        event: 'MENTION_PAGE',
        subjectText: 'Mentioned in Page'
      })
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page has been updated.'))
    })
  })

  describe('delete', () => {
    it('should delete a page successfully and not notify followers when notifyFollowers is omitted', async () => {
      const args = {
        notifyFollowers: undefined,
        id: 'page-id'
      }
      const context = { req, WIKI }

      WIKI.models.pages.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue({
          id: 'page-id',
          siteId: 'site-id'
        })
      })
      WIKI.models.pages.deletePage = jest.fn().mockResolvedValue()

      const result = await PageMutation.delete(null, args, context)

      expect(notifyUsers).not.toHaveBeenCalled()
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page has been deleted.'))
    })

    it('should notify followers when notifyFollowers is true', async () => {
      const args = {
        notifyFollowers: true,
        id: 'page-id'
      }
      const context = { req, WIKI }

      WIKI.models.pages.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue({
          id: 'page-id',
          siteId: 'site-id',
          title: 'Test Page',
          path: 'test-page',
          sitePath: 'site-path'
        })
      })
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockResolvedValue([{ userId: 2 }])
      })
      WIKI.models.pages.deletePage = jest.fn().mockResolvedValue()

      const result = await PageMutation.delete(null, args, context)

      expect(notifyUsers).toHaveBeenCalledWith({
        siteId: 'site-id',
        pageId: 'page-id',
        pageTitle: 'Test Page',
        pagePath: 'test-page',
        sitePath: 'site-path',
        userEmail: context.req.user.email,
        userIds: [2],
        event: 'DELETE_PAGE',
        subjectText: 'Deleted Page'
      })
      expect(result.responseResult).toEqual(graphHelper.generateSuccess('Page has been deleted.'))
    })
  })
})
