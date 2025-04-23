const { PageMutation } = require('../../../graph/resolvers/page')
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
      updatePage: jest.fn()
    },
    users: {
      query: jest.fn()
    }
  }
}

describe('Page Resolvers', () => {
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
})
