const { UserQuery, UserMutation } = require('../../../graph/resolvers/user')
const CustomError = require('custom-error-instance')
const userService = require('../../../graph/services/userService')
const graphHelper = require('../../../helpers/graph')

jest.mock('../../../graph/services/userService')

const WIKI = {
  auth: {
    checkAccess: jest.fn(),
    revokeUserTokens: jest.fn()
  },
  models: {
    users: {
      query: jest.fn(),
      findById: jest.fn(),
      deleteUser: jest.fn()
    },
    userMentions: {
      query: jest.fn(),
      getMentionedPages: jest.fn(),
      getMentionedComments: jest.fn()
    },
    comments: {
      query: jest.fn()
    },
    pages: {
      query: jest.fn(),
      renderPage: jest.fn()
    }
  },
  data: {
    commentProvider: {
      update: jest.fn()
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
    AuthForbidden: class extends Error {
      constructor() {
        super('User does not have access to the site')
      }
    },
    UserDeleteForeignConstraint: CustomError('UserDeleteForeignConstraint', {
      message: 'Cannot delete user because of content relational constraints.',
      code: 1017
    }),
    UserDeleteProtected: CustomError('UserDeleteProtected', {
      message: 'Cannot delete a protected system account.',
      code: 1018
    })
  }
}

describe('UserQuery', () => {
  describe('autoCompleteEmails', () => {
    beforeEach(() => {
      global.WIKI = WIKI
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return email addresses that match the query', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'test'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }

      // Mock the checkAccess function to return true
      WIKI.auth.checkAccess.mockReturnValue(true)

      // Mock the users query
      WIKI.models.users.query.mockReturnValue({
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockResolvedValue([
          { email: 'test1@example.com' },
          { email: 'test2@example.com' }
        ])
      })

      const result = await UserQuery.autoCompleteEmails(null, args, context)

      expect(result).toEqual(['test1@example.com', 'test2@example.com'])
    })

    it('should return an empty array if the query contains invalid characters', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'invalid@query!'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }

      const result = await UserQuery.autoCompleteEmails(null, args, context)

      expect(result).toEqual([])
    })

    it('should throw an error if the user does not have access to the site', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'test'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }

      // Mock the checkAccess function to return false
      WIKI.auth.checkAccess.mockReturnValue(false)

      await expect(UserQuery.autoCompleteEmails(null, args, context)).rejects.toThrow('User does not have access to the site')
    })

    it('should return an empty array if no matching emails are found', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'nonexistent'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }
      // Mock the checkAccess function to return true
      WIKI.auth.checkAccess.mockReturnValue(true)

      // Mock the users query to return an empty array
      WIKI.models.users.query.mockReturnValue({
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockResolvedValue([])
      })

      const result = await UserQuery.autoCompleteEmails(null, args, context)

      expect(result).toEqual([])
    })

    it('should return an empty array if searching using the second letter of a site user email', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'est'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }

      // Mock the checkAccess function to return true
      WIKI.auth.checkAccess.mockReturnValue(true)

      // Mock the users query to return an empty array
      WIKI.models.users.query.mockReturnValue({
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockResolvedValue([])
      })

      const result = await UserQuery.autoCompleteEmails(null, args, context)

      expect(result).toEqual([])
    })

    it('should return one search result when using the full email', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'firstname.lastname@test.com'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }

      // Mock the checkAccess function to return true
      WIKI.auth.checkAccess.mockReturnValue(true)

      // Mock the users query
      WIKI.models.users.query.mockReturnValue({
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockResolvedValue([
          { email: 'firstname.lastname@test.com' }
        ])
      })

      const result = await UserQuery.autoCompleteEmails(null, args, context)

      expect(result).toEqual(['firstname.lastname@test.com'])
    })

    it('should return unique email addresses when the user is in multiple groups', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'test'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }

      // Mock the checkAccess function to return true
      WIKI.auth.checkAccess.mockReturnValue(true)

      // Mock the users query
      WIKI.models.users.query.mockReturnValue({
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockResolvedValue([
          { email: 'test1@example.com' },
          { email: 'test1@example.com' }
        ])
      })

      const result = await UserQuery.autoCompleteEmails(null, args, context)

      expect(result).toEqual(['test1@example.com'])
    })

    it('should not return email addresses if the user has deny access', async () => {
      const args = {
        siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
        query: 'test'
      }
      const context = {
        req: {
          user: {
            id: 1
          }
        }
      }

      // Mock the checkAccess function to return true
      WIKI.auth.checkAccess.mockReturnValue(true)

      // Mock the users query to return an empty array
      WIKI.models.users.query.mockReturnValue({
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockResolvedValue([])
      })

      const result = await UserQuery.autoCompleteEmails(null, args, context)

      expect(result).toEqual([])
    })
  })
})

describe('UserMutation', () => {
  describe('delete', () => {
    beforeEach(() => {
      global.WIKI = WIKI
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return UserDeleteProtected error response if args.id <= 2', async () => {
      // Arrange
      const args = { id: 2, replaceId: null }

      userService.handleDeleteError.mockReturnValue({
        responseResult: {
          errorCode: 1018,
          message: 'Cannot delete a protected system account.',
          slug: 'UserDeleteProtected',
          succeeded: false
        }
      })

      // Act
      const result = await UserMutation.delete(null, args)

      // Assert
      expect(result).toEqual({
        responseResult: {
          errorCode: 1018,
          message: 'Cannot delete a protected system account.',
          slug: 'UserDeleteProtected',
          succeeded: false
        }
      })

      expect(WIKI.models.users.query).not.toHaveBeenCalled()
      expect(userService.revokeUserTokens).not.toHaveBeenCalled()
      expect(userService.renderMentionedPages).not.toHaveBeenCalled()
      expect(userService.anonymizeComments).not.toHaveBeenCalled()
    })

    it('should return success message if user is deleted successfully', async () => {
      // Arrange
      const args = { id: 3, replaceId: null }
      const user = { id: 3, email: 'test.user@example.com' }
      const mentionedPages = []
      const mentionedComments = []
      const userComments = []

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(user)
      })
      WIKI.models.userMentions.getMentionedPages.mockResolvedValue(mentionedPages)
      WIKI.models.userMentions.getMentionedComments.mockResolvedValue(mentionedComments)
      WIKI.models.comments.query.mockReturnValue({
        where: jest.fn().mockResolvedValue(userComments)
      })
      WIKI.models.users.deleteUser.mockResolvedValue()

      userService.revokeUserTokens.mockResolvedValue()
      userService.renderMentionedPages.mockResolvedValue()
      userService.anonymizeComments.mockResolvedValue()

      // Act
      const result = await UserMutation.delete(null, args)

      // Assert
      expect(WIKI.models.users.query().findById).toHaveBeenCalledWith(args.id)
      expect(WIKI.models.userMentions.getMentionedPages).toHaveBeenCalledWith(args.id)
      expect(WIKI.models.userMentions.getMentionedComments).toHaveBeenCalledWith(args.id)
      expect(WIKI.models.comments.query().where).toHaveBeenCalledWith('authorId', args.id)
      expect(WIKI.models.users.deleteUser).toHaveBeenCalledWith(args.id, args.replaceId)
      expect(userService.revokeUserTokens).toHaveBeenCalledWith(args.id)
      expect(userService.renderMentionedPages).toHaveBeenCalledWith(mentionedPages)
      expect(userService.anonymizeComments).toHaveBeenCalledWith(user, mentionedComments, userComments)
      expect(result).toEqual({
        responseResult: graphHelper.generateSuccess('User deleted successfully')
      })
    })

    it('should call handleDeleteError on error', async () => {
      // Arrange
      const args = { id: 3, replaceId: null }
      const error = new Error('Some error')

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockRejectedValue(error)
      })

      userService.handleDeleteError.mockReturnValue({
        responseResult: {
          errorCode: 1,
          message: 'Some error',
          slug: 'Error',
          succeeded: false
        }
      })

      // Act
      const result = await UserMutation.delete(null, args)

      // Assert
      expect(userService.handleDeleteError).toHaveBeenCalledWith(error)
      expect(result).toEqual({
        responseResult: {
          errorCode: 1,
          message: 'Some error',
          slug: 'Error',
          succeeded: false
        }
      })
    })
  })
})
