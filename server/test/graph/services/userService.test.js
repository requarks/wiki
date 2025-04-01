const userService = require('../../../graph/services/userService')
const graphHelper = require('../../../helpers/graph')

const WIKI = {
  auth: {
    revokeUserTokens: jest.fn()
  },
  events: {
    outbound: {
      emit: jest.fn()
    }
  },
  models: {
    pages: {
      query: jest.fn(),
      renderPage: jest.fn()
    },
    comments: {
      query: jest.fn()
    }
  },
  data: {
    commentProvider: {
      update: jest.fn()
    }
  },
  Error: {
    UserDeleteForeignConstraint: class extends Error {
      constructor() {
        super('Cannot delete user because of content relational constraints.')
      }
    }
  }
}

function setupMocks(comments, pages) {
  WIKI.models.comments.query.mockReturnValue({
    findById: jest.fn().mockImplementation(id => comments.find(comment => comment.id === id))
  })
  WIKI.models.pages.query.mockReturnValue({
    findById: jest.fn().mockImplementation(findPageById(pages))
  })
}

function findPageById(pages) {
  return id => pages.find(page => page.id === id)
}

describe('userService', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('revokeUserTokens', () => {
    it('should revoke user tokens and emit an event', async () => {
      // Arrange
      const userId = 1

      // Act
      await userService.revokeUserTokens(userId)

      // Assert
      expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: userId, kind: 'u' })
      expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: userId, kind: 'u' })
    })
  })

  describe('renderMentionedPages', () => {
    it('should render mentioned pages', async () => {
      // Arrange
      const mentionedPages = [{ pageId: 1 }, { pageId: 2 }]
      const pages = [{ id: 1 }, { id: 2 }]

      setupMocks([], pages)

      // Act
      await userService.renderMentionedPages(mentionedPages)

      // Assert
      expect(WIKI.models.pages.query().findById).toHaveBeenCalledTimes(2)
      expect(WIKI.models.pages.renderPage).toHaveBeenCalledTimes(2)
      expect(WIKI.models.pages.renderPage).toHaveBeenCalledWith(pages[0])
      expect(WIKI.models.pages.renderPage).toHaveBeenCalledWith(pages[1])
    })
  })

  describe('anonymizeComments', () => {
    it('should anonymize comments where the user was mentioned by others', async () => {
      // Arrange
      const userId = 3
      const user = { id: userId, email: 'test.user@example.com' }
      const mentionedComments = [
        { pageId: 1, commentId: 3 }
      ]
      const comments = [
        { id: 3, content: 'Mentioning @test.user@example.com in a comment', pageId: 1, authorId: 4 }
      ]
      const pages = [
        { id: 1 }
      ]

      setupMocks(comments, pages)

      // Act
      await userService.anonymizeComments(user, mentionedComments, [])

      // Assert
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledTimes(1)
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledWith({
        id: 3,
        content: 'Mentioning @AnonymousUser in a comment',
        page: pages[0]
      })
    })
    it('should anonymize comments authored by the user mentioning others', async () => {
      // Arrange
      const userId = 3
      const user = { id: userId, email: 'test.user@example.com' }
      const mentionedComments = []
      const userCommentomments = [
        { id: 1, content: 'Hello @other.user@example.com', pageId: 1, authorId: userId },
        { id: 2, content: 'Hi @other.user@example.com', pageId: 2, authorId: userId }
      ]
      const pages = [
        { id: 1 },
        { id: 2 }
      ]

      setupMocks(userCommentomments, pages)

      // Act
      await userService.anonymizeComments(user, mentionedComments, userCommentomments)

      // Assert
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledTimes(2)
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledWith({
        id: userCommentomments[0].id,
        content: userCommentomments[0].content,
        page: pages[0],
        name: 'Anonymous User',
        email: '[deleted]'
      })
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledWith({
        id: userCommentomments[1].id,
        content: userCommentomments[1].content,
        page: pages[1],
        name: 'Anonymous User',
        email: '[deleted]'
      })
    })
    it('should anonymize comments authored by the user mentioning self', async () => {
      // Arrange
      const userId = 3
      const user = { id: userId, email: 'test.user@example.com' }
      const mentionedComments = [{ pageId: 1, commentId: 1 }, { pageId: 2, commentId: 2 }]
      const userComments = [
        { id: 1, content: 'Hello @test.user@example.com', pageId: 1, authorId: userId },
        { id: 2, content: 'Hi @test.user@example.com', pageId: 2, authorId: userId }
      ]
      const pages = [
        { id: 1 },
        { id: 2 }
      ]

      setupMocks(userComments, pages)

      // Act
      await userService.anonymizeComments(user, mentionedComments, userComments)

      // Assert
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledTimes(2)
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledWith({
        id: 1,
        content: 'Hello @AnonymousUser',
        page: pages[0],
        name: 'Anonymous User',
        email: '[deleted]'
      })
      expect(WIKI.data.commentProvider.update).toHaveBeenCalledWith({
        id: 2,
        content: 'Hi @AnonymousUser',
        page: pages[1],
        name: 'Anonymous User',
        email: '[deleted]'
      })
    })
  })

  describe('handleDeleteError', () => {
    it('should handle foreign key constraint error', () => {
      const error = new Error('foreign key constraint')

      const result = userService.handleDeleteError(error)

      expect(result).toEqual(graphHelper.generateError(new WIKI.Error.UserDeleteForeignConstraint()))
    })

    it('should handle other errors', () => {
      const error = new Error('Some other error')

      const result = userService.handleDeleteError(error)

      expect(result).toEqual(graphHelper.generateError(error))
    })
  })
})
