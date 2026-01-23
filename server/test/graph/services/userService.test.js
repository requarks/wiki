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
    },
    userMentions: {
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
jest.mock('../../../helpers/anonymizeInactiveUsersHelpers', () => ({
  retrieveOrCreateAnonymousUser: jest.fn().mockResolvedValue({ id: 999 })
}))

function setupMocks(comments, pages) {
  WIKI.models.comments.query.mockReturnValue({
    findById: jest.fn().mockImplementation(id => {
      const comment = comments.find(comment => comment.id === id)
      if (comment) {
        return {
          ...comment,
          patch: jest.fn().mockResolvedValue(comment)
        }
      }
      return null
    })
  })
  WIKI.models.pages.query.mockReturnValue({
    findById: jest.fn().mockImplementation(findPageById(pages))
  })
  WIKI.models.userMentions.query.mockReturnValue({
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis()
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
    const anonymousUser = { id: 999 }
    let patchMock

    beforeEach(() => {
      patchMock = jest.fn()
    })

    it('should anonymize comments where the user was mentioned by others', async () => {
      // Arrange
      const userId = 3
      const user = { id: userId, email: 'test.user@example.com' }
      const mentionedComments = [
        { pageId: 1, commentId: 3 }
      ]
      const comments = [
        { id: 3, content: 'Mentioning @test.user@example.com in a comment', render: 'Mentioning <span class="mention" data-mention="test.user@example.com">@test.user@example.com</span> in a comment', pageId: 1, authorId: 4, patch: patchMock }
      ]
      const pages = [
        { id: 1 }
      ]

      setupMocks(comments, pages)

      // Act
      await userService.anonymizeComments(user, mentionedComments, [], anonymousUser)

      // Assert
      expect(patchMock).toHaveBeenCalledTimes(1)
      expect(patchMock).toHaveBeenCalledWith({
        content: 'Mentioning @AnonymousUser in a comment',
        render: 'Mentioning @AnonymousUser in a comment'
      })
    })
    it('should anonymize comments authored by the user mentioning others', async () => {
      // Arrange
      const userId = 3
      const user = { id: userId, email: 'test.user@example.com' }
      const mentionedComments = []
      const patchMock1 = jest.fn()
      const patchMock2 = jest.fn()
      const userCommentomments = [
        { id: 1, content: 'Hello @other.user@example.com', render: 'Hello <span class="mention" data-mention="other.user@example.com">@other.user@example.com</span>', pageId: 1, authorId: userId, patch: patchMock1 },
        { id: 2, content: 'Hi @other.user@example.com', render: 'Hi <span class="mention" data-mention="other.user@example.com">@other.user@example.com</span>', pageId: 2, authorId: userId, patch: patchMock2 }
      ]
      const pages = [
        { id: 1 },
        { id: 2 }
      ]

      setupMocks(userCommentomments, pages)

      // Act
      await userService.anonymizeComments(user, mentionedComments, userCommentomments, anonymousUser)

      // Assert
      expect(patchMock1).toHaveBeenCalledWith({
        content: userCommentomments[0].content,
        render: userCommentomments[0].render,
        name: 'Anonymous User',
        email: '[deleted]',
        authorId: anonymousUser.id
      })
      expect(patchMock2).toHaveBeenCalledWith({
        content: userCommentomments[1].content,
        render: userCommentomments[1].render,
        name: 'Anonymous User',
        email: '[deleted]',
        authorId: anonymousUser.id
      })
    })
    it('should anonymize comments authored by the user mentioning self', async () => {
      // Arrange
      const userId = 3
      const user = { id: userId, email: 'test.user@example.com' }
      const mentionedComments = [{ pageId: 1, commentId: 1 }, { pageId: 2, commentId: 2 }]
      const patchMock1 = jest.fn()
      const patchMock2 = jest.fn()
      const userComments = [
        { id: 1, content: 'Hello @test.user@example.com', render: 'Hello <span class="mention" data-mention="test.user@example.com">@test.user@example.com</span>', pageId: 1, authorId: userId, patch: patchMock1 },
        { id: 2, content: 'Hi @test.user@example.com', render: 'Hi <span class="mention" data-mention="test.user@example.com">@test.user@example.com</span>', pageId: 2, authorId: userId, patch: patchMock2 }
      ]
      const pages = [
        { id: 1 },
        { id: 2 }
      ]

      setupMocks(userComments, pages)

      // Act
      await userService.anonymizeComments(user, mentionedComments, userComments, anonymousUser)

      // Assert
      expect(patchMock1).toHaveBeenCalledWith({
        content: 'Hello @AnonymousUser',
        render: 'Hello @AnonymousUser',
        name: 'Anonymous User',
        email: '[deleted]',
        authorId: anonymousUser.id
      })
      expect(patchMock2).toHaveBeenCalledWith({
        content: 'Hi @AnonymousUser',
        render: 'Hi @AnonymousUser',
        name: 'Anonymous User',
        email: '[deleted]',
        authorId: anonymousUser.id
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

  describe('anonymizeUserMentions', () => {
    const email = 'test.user@example.com'
    const { anonymizeUserMentions } = userService

    it('should anonymize markdown mentions', () => {
      const content = 'Hello @test.user@example.com, please review.'
      const result = anonymizeUserMentions(content, 'markdown', email)
      expect(result).toBe('Hello @AnonymousUser, please review.')
    })

    it('should anonymize multiple markdown mentions', () => {
      const content = '@test.user@example.com and @test.user@example.com and @user@example.com'
      const result = anonymizeUserMentions(content, 'markdown', email)
      expect(result).toBe('@AnonymousUser and @AnonymousUser and @user@example.com')
    })

    it('should anonymize html mentions', () => {
      const content = '<span class="mention" data-mention="test.user@example.com">@test.user@example.com</span> is here'
      const result = anonymizeUserMentions(content, 'html', email)
      expect(result).toBe('@AnonymousUser is here')
    })

    it('should anonymize multiple html mentions', () => {
      const content = '<span class="mention" data-mention="test.user@example.com">@test.user@example.com</span> and <span class="mention" data-mention="test.user@example.com">@test.user@example.com</span> and <span class="mention" data-mention="user@example.com">@user@example.com</span>'
      const result = anonymizeUserMentions(content, 'html', email)
      expect(result).toBe('@AnonymousUser and @AnonymousUser and <span class="mention" data-mention="user@example.com">@user@example.com</span>')
    })

    it('should return content unchanged for ascii contentType', () => {
      const email = 'test.user@example.com'
      const { anonymizeUserMentions } = userService
      const content = 'This is some ascii content with @test.user@example.com'
      const result = anonymizeUserMentions(content, 'ascii', email)
      expect(result).toBe(content)
    })
  })
})
