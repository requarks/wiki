// Imports removed; module re-required after mocking inside test

describe('group resolver assignUser email', () => {
  let originalWiki
  beforeEach(() => {
    originalWiki = global.WIKI
    global.WIKI = {
      config: {
        host: 'http://localhost:3000',
        title: 'Test Wiki',
        mail: { host: 'localhost', port: 1025, senderName: 'Test', senderEmail: 'noreply@test.local' },
        logoUrl: '/logo.png',
        company: 'TestCo'
      },
      logger: { warn: jest.fn() },
      auth: { revokeUserTokens: jest.fn(), checkExclusiveAccess: () => false, isSuperAdmin: () => true },
      events: { outbound: { emit: jest.fn() } },
      models: {
        groups: { query: () => ({ findById: jest.fn().mockResolvedValue({ id: 5, name: 'Dev', permissions: [], $relatedQuery: () => ({ relate: jest.fn().mockResolvedValue() }) }) }) },
        users: { query: () => ({ findById: jest.fn().mockResolvedValue({ id: 10, email: 'user@example.com', name: 'User' }) }) },
        knex: jest.fn().mockImplementation(() => ({ where: () => ({ first: () => Promise.resolve(null) }) })),
        userMentions: { query: jest.fn() }
      }
    }
  })
  afterEach(() => {
    global.WIKI = originalWiki
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('calls sendUserAddedToGroupEmail and succeeds', async () => {
    const mockSend = jest.fn().mockResolvedValue(true)
    jest.doMock('../../../core/mail', () => ({ init: () => ({ transport: {}, send: mockSend }) }))
    jest.resetModules()
    const localGroupResolver = require('../../../graph/resolvers/group')
    await localGroupResolver.GroupMutation.assignUser({}, { groupId: 5, userId: 10 }, { req: { user: { id: 1, groups: [] } } })
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com', template: 'user-added-to-group' }))
  })
})
