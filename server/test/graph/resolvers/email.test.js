const userService = require('../../../graph/services/userService')
const groupResolvers = require('../../../graph/resolvers/group')
const UserModel = require('../../../models/users')

jest.mock('../../../graph/services/userService')

const WIKI = {
  auth: {
    revokeUserTokens: jest.fn(),
    isSuperAdmin: jest.fn(),
    isSiteAdmin: jest.fn(),
    checkExclusiveAccess: jest.fn(),
    checkAccess: jest.fn()
  },
  models: {
    users: {
      query: jest.fn()
    },
    groups: {
      query: jest.fn()
    },
    knex: jest.fn()
  },
  events: { outbound: { emit: jest.fn() } },
  logger: { warn: jest.fn() },
  Error: require('../../../helpers/error')
}

describe('Email Notifications', () => {
  beforeEach(() => {
    global.WIKI = WIKI
    jest.clearAllMocks()
  })

  describe('createNewUser sends welcome email', () => {
    it('sends welcome email and sets welcomeMailWasSent for script user', async () => {
      const insertedUser = { id: 42, email: 'scriptuser@example.com', name: 'Script User' }
      // mock insert and patch chain
      WIKI.models.users.query.mockReturnValueOnce({ findOne: jest.fn().mockResolvedValue(null) })
      WIKI.models.users.query.mockReturnValueOnce({ insert: jest.fn().mockResolvedValue(insertedUser) })
      // patch call after email
      WIKI.models.users.query.mockReturnValueOnce({ patch: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue(1) })

      userService.sendWelcomeEmail.mockResolvedValue(true)

      await UserModel.createNewUser({ providerKey: 'local', email: 'scriptuser@example.com', passwordRaw: 'secret12', name: 'Script User', groups: [], mustChangePassword: false, sendWelcomeEmail: true, createdByScript: true })

      expect(userService.sendWelcomeEmail).toHaveBeenCalledWith(insertedUser)
      const patchMock = WIKI.models.users.query.mock.results[2].value.patch
      expect(patchMock).toHaveBeenCalledWith({ welcomeMailWasSent: true })
    })
  })

  describe('assignUser sends group email', () => {
    it('sends user-added-to-group email after assignment', async () => {
      const grp = { id: 5, name: 'Docs', permissions: [], $relatedQuery: jest.fn(() => ({ relate: jest.fn().mockResolvedValue(true) })) }
      const usr = { id: 7, email: 'member@example.com', name: 'Member User' }

      WIKI.models.groups.query.mockReturnValue({ findById: jest.fn().mockResolvedValue(grp) })
      WIKI.models.users.query.mockReturnValue({ findById: jest.fn().mockResolvedValue(usr) })
      WIKI.models.knex.mockReturnValue({ where: jest.fn(() => ({ first: jest.fn().mockResolvedValue(null) })) })

      WIKI.auth.checkExclusiveAccess.mockReturnValue(false)
      WIKI.auth.isSuperAdmin.mockReturnValue(true)

      userService.sendUserAddedToGroupEmail.mockResolvedValue(true)

      const args = { groupId: grp.id, userId: usr.id }
      const req = { user: { id: 1, groups: [grp.id], permissions: ['manage:sites'] } }

      const result = await groupResolvers.GroupMutation.assignUser(null, args, { req })
      expect(result.responseResult.message).toBe('User has been assigned to group.')
      expect(userService.sendUserAddedToGroupEmail).toHaveBeenCalledWith(usr, grp)
    })
  })
})
