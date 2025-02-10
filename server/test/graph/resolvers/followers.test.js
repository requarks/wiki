const { Query, Mutation } = require('../../../graph/resolvers/followers')
const { generateError, generateSuccess } = require('../../../helpers/graph')

jest.mock('../../../helpers/graph', () => ({
  generateError: jest.fn(),
  generateSuccess: jest.fn()
}))

const WIKI = {
  auth: {
    checkAccess: jest.fn()
  },
  models: {
    followers: {
      query: jest.fn()
    }
  },
  logger: {
    warn: jest.fn()
  },
  events: {
    outbound: {
      emit: jest.fn()
    }
  },
  Error: {
    AlreadyFollower: class extends Error {
      constructor() {
        super('You are already following this page')
      }
    }
  }
}

describe('Followers Resolvers', () => {
  let req

  beforeEach(() => {
    req = {
      user: { id: 1 },
      siteId: 'site-id'
    }
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('isFollowing', () => {
    it('returns true if the user is following the page', async () => {
      WIKI.models.followers.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ userId: 1, siteId: 'site-id', pageId: 1 })
      })
      generateSuccess.mockReturnValue({ succeeded: true, message: 'User is following' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Query.isFollowing(null, args, context)

      expect(WIKI.models.followers.query().findOne).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(result).toEqual({ operation: { succeeded: true, message: 'User is following' }, isFollowing: true })
    })

    it('returns false if the user is not following the page', async () => {
      WIKI.models.followers.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
      generateSuccess.mockReturnValue({ succeeded: true, message: 'User is following' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Query.isFollowing(null, args, context)

      expect(WIKI.models.followers.query().findOne).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(result).toEqual({ operation: { succeeded: true, message: 'User is following' }, isFollowing: false })
    })

    it('returns an error if there is an issue with the query', async () => {
      const error = new Error('Database error')
      WIKI.models.followers.query.mockReturnValue({
        findOne: jest.fn().mockRejectedValue(error)
      })
      generateError.mockReturnValue({ succeeded: false, message: 'Database error' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Query.isFollowing(null, args, context)

      expect(WIKI.models.followers.query().findOne).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(result).toEqual({ succeeded: false, message: 'Database error' })
    })
  })

  describe('createFollower', () => {
    it('creates a new follower for a site', async () => {
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockResolvedValue({ id: 1, userId: 1, siteId: 'site-id', pageId: null })
      })
      WIKI.auth.checkAccess.mockReturnValue(true)
      generateSuccess.mockReturnValue({ succeeded: true, message: 'Successfully followed the site' })

      const args = { siteId: 'site-id', pageId: null }
      const context = { req, WIKI }
      const result = await Mutation.createFollower(null, args, context)

      expect(WIKI.models.followers.query().where).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: null })
      expect(WIKI.models.followers.query().first).toHaveBeenCalled()
      expect(WIKI.models.followers.query().insert).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: null })
      expect(result).toEqual({
        operation: { succeeded: true, message: 'Successfully followed the site' },
        follower: { id: 1, userId: 1, siteId: 'site-id', pageId: null }
      })
    })

    it('returns an error if the user is already following the site', async () => {
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 1, userId: 1, siteId: 'site-id', pageId: null })
      })
      WIKI.auth.checkAccess.mockReturnValue(true)
      generateError.mockReturnValue({ succeeded: false, message: 'You are already following this site' })

      const args = { siteId: 'site-id', pageId: null }
      const context = { req, WIKI }
      const result = await Mutation.createFollower(null, args, context)

      expect(WIKI.models.followers.query().where).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: null })
      expect(WIKI.models.followers.query().first).toHaveBeenCalled()
      expect(result).toEqual({
        operation: { succeeded: false, message: 'You are already following this site' },
        follower: null
      })
    })

    it('creates a new follower', async () => {
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockResolvedValue({ id: 1, userId: 1, siteId: 'site-id', pageId: 1 })
      })
      WIKI.auth.checkAccess.mockReturnValue(true)
      generateSuccess.mockReturnValue({ succeeded: true, message: 'Successfully followed the page' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Mutation.createFollower(null, args, context)

      expect(WIKI.models.followers.query().where).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(WIKI.models.followers.query().insert).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(result).toEqual({
        operation: { succeeded: true, message: 'Successfully followed the page' },
        follower: { id: 1, userId: 1, siteId: 'site-id', pageId: 1 }
      })
    })

    it('returns an error if the user is already following the page', async () => {
      WIKI.models.followers.query.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 1, userId: 1, siteId: 'site-id', pageId: 1 })
      })
      WIKI.auth.checkAccess.mockReturnValue(true)
      generateError.mockReturnValue({ succeeded: false, message: 'You are already following this page' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Mutation.createFollower(null, args, context)

      expect(WIKI.models.followers.query().where).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(result).toEqual({
        operation: { succeeded: false, message: 'You are already following this page' },
        follower: null
      })
    })

    it('returns an error if the user does not have access', async () => {
      WIKI.auth.checkAccess.mockReturnValue(false)
      generateError.mockReturnValue({ succeeded: false, message: 'ERR_FORBIDDEN' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Mutation.createFollower(null, args, context)

      expect(WIKI.auth.checkAccess).toHaveBeenCalledWith(req.user, ['read:pages'])
      expect(result).toEqual({
        operation: { succeeded: false, message: 'ERR_FORBIDDEN' },
        follower: null
      })
    })
  })

  describe('deleteFollower', () => {
    it('deletes a follower for a site', async () => {
      WIKI.models.followers.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 1, userId: 1, siteId: 'site-id', pageId: null }),
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(1)
      })
      generateSuccess.mockReturnValue({ succeeded: true, message: 'Successfully unfollowed the site' })

      const args = { siteId: 'site-id', pageId: null }
      const context = { req, WIKI }
      const result = await Mutation.deleteFollower(null, args, context)

      expect(WIKI.models.followers.query().findOne).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: null })
      expect(WIKI.models.followers.query().delete().where).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: null })
      expect(result).toEqual({responseResult: { succeeded: true, message: 'Successfully unfollowed the site' }})
    })

    it('returns an error if the user is not following the site', async () => {
      WIKI.models.followers.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
      generateError.mockReturnValue({ succeeded: false, message: 'You are not following this site' })

      const args = { siteId: 'site-id', pageId: null }
      const context = { req, WIKI }
      const result = await Mutation.deleteFollower(null, args, context)

      expect(WIKI.models.followers.query().findOne).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: null })
      expect(result).toEqual({ succeeded: false, message: 'You are not following this site' })
    })

    it('deletes a follower', async () => {
      WIKI.models.followers.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 1, userId: 1, siteId: 'site-id', pageId: 1 }),
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(1)
      })
      generateSuccess.mockReturnValue({ succeeded: true, message: 'Successfully unfollowed the page' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Mutation.deleteFollower(null, args, context)

      expect(WIKI.models.followers.query().findOne).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(WIKI.models.followers.query().delete().where).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(result).toEqual({responseResult: { succeeded: true, message: 'Successfully unfollowed the page' }})
    })

    it('returns an error if the user is not following the page', async () => {
      WIKI.models.followers.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
      generateError.mockReturnValue({ succeeded: false, message: 'You are not following this page' })

      const args = { siteId: 'site-id', pageId: 1 }
      const context = { req, WIKI }
      const result = await Mutation.deleteFollower(null, args, context)

      expect(WIKI.models.followers.query().findOne).toHaveBeenCalledWith({ userId: 1, siteId: 'site-id', pageId: 1 })
      expect(result).toEqual({ succeeded: false, message: 'You are not following this page' })
    })
  })
})
