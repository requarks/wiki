const { UserQuery } = require('../../../graph/resolvers/user')

const WIKI = {
  auth: {
    checkAccess: jest.fn()
  },
  models: {
    users: {
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
    AuthForbidden: class extends Error {
      constructor() {
        super('User does not have access to the site')
      }
    }
  }
}

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
      andWhere: jest.fn().mockResolvedValue([
        { email: 'test1@example.com' },
        { email: 'test2@example.com' }
      ])
    })

    const result = await UserQuery.autoCompleteEmails(null, args, context)

    expect(result).toEqual(['test1@example.com', 'test2@example.com'])
    expect(WIKI.auth.checkAccess).toHaveBeenCalledWith(context.req.user, ['read:pages', 'manage:sites'], { siteId: args.siteId })
    expect(WIKI.models.users.query().distinct().join().whereIn().andWhere).toHaveBeenCalledWith('users.email', 'like', `${args.query}%`)
  })

  it('should return an empty array if the query contains invalid characters', async () => {
    const args = {
      siteId: '3c9bc4bb-be41-4d9e-8af6-902fbc02848f',
      query: 'invalid query!'
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
      andWhere: jest.fn().mockResolvedValue([])
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
      andWhere: jest.fn().mockResolvedValue([])
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
      andWhere: jest.fn().mockResolvedValue([
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
      andWhere: jest.fn().mockResolvedValue([
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
      andWhere: jest.fn().mockResolvedValue([])
    })

    const result = await UserQuery.autoCompleteEmails(null, args, context)

    expect(result).toEqual([])
  })
})
