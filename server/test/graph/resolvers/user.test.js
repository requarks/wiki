const { Query, UserMutation } = require('../../../graph/resolvers/user')
const userService = require('../../../graph/services/userService')
const graphHelper = require('../../../helpers/graph')

jest.mock('../../../graph/services/userService')

const WIKI = {
  auth: {
    checkAccess: jest.fn(),
    revokeUserTokens: jest.fn(),
    isSuperAdmin: jest.fn()
  },
  models: {
    users: {
      query: jest.fn(),
      findById: jest.fn(),
      deleteUser: jest.fn(),
      updateUser: jest.fn(),
      refreshToken: jest.fn()
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
    },
    pageHistory: {
      anonymizeMentionsByPageIds: jest.fn()
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
  Error: require('../../../helpers/error')
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

      const result = await Query.autoCompleteEmails(null, args, context)

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

      const result = await Query.autoCompleteEmails(null, args, context)

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

      await expect(Query.autoCompleteEmails(null, args, context)).rejects.toThrow(new WIKI.Error.SiteForbidden())
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

      const result = await Query.autoCompleteEmails(null, args, context)

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

      const result = await Query.autoCompleteEmails(null, args, context)

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

      const result = await Query.autoCompleteEmails(null, args, context)

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

      const result = await Query.autoCompleteEmails(null, args, context)

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

      const result = await Query.autoCompleteEmails(null, args, context)

      expect(result).toEqual([])
    })
  })
})

describe('UserMutation', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('delete', () => {
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
      WIKI.models.userMentions.query.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis()
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
      userService.anonymizeUserMentions.mockResolvedValue()

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
    it('should anonymize page history and delete user mentions when deleting a user', async () => {
      // Arrange
      const args = { id: 42, replaceId: null }
      const user = { id: 42, email: 'test@example.com' }
      const mentionedPages = [{ pageId: 1 }, { pageId: 2 }]
      const mentionedComments = []
      const userComments = []

      // Mock all DB/model/service calls
      WIKI.models.users.query = jest.fn(() => ({ findById: jest.fn(() => user) }))
      WIKI.models.userMentions.getMentionedPages = jest.fn(() => mentionedPages)
      WIKI.models.userMentions.getMentionedComments = jest.fn(() => mentionedComments)
      WIKI.models.comments.query = jest.fn(() => ({ where: jest.fn(() => userComments) }))
      WIKI.models.users.deleteUser = jest.fn()
      userService.revokeUserTokens = jest.fn()
      WIKI.models.pageHistory.anonymizeMentionsByPageIds = jest.fn()
      userService.renderMentionedPages = jest.fn()
      userService.anonymizeComments = jest.fn()

      // Act
      const result = await UserMutation.delete({}, args)

      // Assert
      expect(WIKI.models.pageHistory.anonymizeMentionsByPageIds).toHaveBeenCalledWith(
        [1, 2],
        expect.any(Function)
      )
      expect(result.responseResult).toBeDefined()
    })
  })

  describe('updateProfile', () => {
    it('Super admin can update own profile including display name successfully', async () => {
      const args = {
        name: 'Updated Name',
        jobTitle: 'Updated Job Title',
        location: 'Updated Location',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        appearance: 'dark'
      }
      const context = {
        req: {
          user: {
            id: 3
          }
        }
      }
      const usr = {
        id: 3,
        isActive: true,
        isVerified: true,
        name: 'Old Name'
      }
      const newToken = { token: 'new.jwt.token' }

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(usr)
      })
      WIKI.auth.isSuperAdmin.mockReturnValue(true)
      WIKI.models.users.updateUser.mockResolvedValue()
      WIKI.models.users.refreshToken.mockResolvedValue(newToken)

      const result = await UserMutation.updateProfile(null, args, context)

      expect(WIKI.models.users.query().findById).toHaveBeenCalledWith(
        context.req.user.id
      )
      expect(WIKI.models.users.updateUser).toHaveBeenCalledWith({
        id: usr.id,
        name: args.name,
        jobTitle: args.jobTitle,
        location: args.location,
        timezone: args.timezone,
        dateFormat: args.dateFormat,
        appearance: args.appearance
      })

      expect(WIKI.models.users.refreshToken).toHaveBeenCalledWith(usr.id)
      expect(result).toEqual({
        responseResult: graphHelper.generateSuccess(
          'User profile updated successfully'
        ),
        jwt: newToken.token
      })
    })

    it('Regular user can update own profile excluding display name successfully', async () => {
      const args = {
        name: 'Updated Name',
        jobTitle: 'Updated Job Title',
        location: 'Updated Location',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        appearance: 'dark'
      }
      const context = {
        req: {
          user: {
            id: 3
          }
        }
      }
      const usr = {
        id: 3,
        isActive: true,
        isVerified: true,
        name: 'Old Name'
      }
      const newToken = { token: 'new.jwt.token' }

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(usr)
      })
      WIKI.auth.isSuperAdmin.mockReturnValue(false)
      WIKI.models.users.updateUser.mockResolvedValue()
      WIKI.models.users.refreshToken.mockResolvedValue(newToken)

      const result = await UserMutation.updateProfile(null, args, context)

      expect(WIKI.models.users.query().findById).toHaveBeenCalledWith(
        context.req.user.id
      )
      expect(WIKI.models.users.updateUser).toHaveBeenCalledWith({
        id: usr.id,
        name: usr.name,
        jobTitle: args.jobTitle,
        location: args.location,
        timezone: args.timezone,
        dateFormat: args.dateFormat,
        appearance: args.appearance
      })

      expect(WIKI.models.users.refreshToken).toHaveBeenCalledWith(usr.id)
      expect(result).toEqual({
        responseResult: graphHelper.generateSuccess(
          'User profile updated successfully'
        ),
        jwt: newToken.token
      })
    })

    it('should throw AuthRequired error if the user is not authenticated', async () => {
      const args = {}
      const context = {
        req: {
          user: null
        }
      }

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(null)
      })

      const result = await UserMutation.updateProfile(null, args, context)
      expect(result).toEqual(graphHelper.generateError(new WIKI.Error.AuthRequired()))
    })

    it('should throw AuthAccountBanned error if the user is inactive', async () => {
      const args = {}
      const context = {
        req: {
          user: {
            id: 3
          }
        }
      }
      const usr = {
        id: 3,
        isActive: false
      }

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(usr)
      })

      const result = await UserMutation.updateProfile(null, args, context)
      expect(result).toEqual(graphHelper.generateError(new WIKI.Error.AuthAccountBanned()))
    })

    it('should throw AuthAccountNotVerified error if the user is not verified', async () => {
      const args = {}
      const context = {
        req: {
          user: {
            id: 3
          }
        }
      }
      const usr = {
        id: 3,
        isActive: true,
        isVerified: false
      }

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(usr)
      })
      const result = await UserMutation.updateProfile(null, args, context)
      expect(result).toEqual(graphHelper.generateError(new WIKI.Error.AuthAccountNotVerified()))
    })

    it('should throw InputInvalid error if the dateFormat is invalid', async () => {
      const args = {
        dateFormat: 'INVALID_DATE_FORMAT'
      }
      const context = {
        req: {
          user: {
            id: 3
          }
        }
      }
      const usr = {
        id: 3,
        isActive: true,
        isVerified: true
      }

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(usr)
      })
      const result = await UserMutation.updateProfile(null, args, context)
      expect(result).toEqual(graphHelper.generateError(new WIKI.Error.InputInvalid()))
    })

    it('should throw InputInvalid error if the appearance is invalid', async () => {
      const args = {
        appearance: 'INVALID_APPEARANCE'
      }
      const context = {
        req: {
          user: {
            id: 3
          }
        }
      }
      const usr = {
        id: 3,
        isActive: true,
        isVerified: true
      }

      WIKI.models.users.query.mockReturnValue({
        findById: jest.fn().mockResolvedValue(usr)
      })
      const result = await UserMutation.updateProfile(null, args, context)
      expect(result).toEqual(graphHelper.generateError(new WIKI.Error.InputInvalid()))
    })
  })
})
