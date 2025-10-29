describe('userService mail functions (with ensureMail)', () => {
  let originalWiki
  beforeEach(() => {
    originalWiki = global.WIKI
    global.WIKI = {
      config: {
        title: 'TestWiki',
        host: 'http://localhost:3000',
        companyName: 'TestCo',
        mail: { host: 'localhost', port: 1025 }
      },
      logger: { warn: jest.fn() }
    }
  })

  afterEach(() => {
    global.WIKI = originalWiki
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('sendWelcomeEmail returns false when ensureMail not ready', async () => {
    jest.resetModules()
    jest.doMock('../../../core/ensure-mail', () => ({ ensureMail: () => false }))
    const localUserService = require('../../../graph/services/userService')
    const user = { email: 'user@example.com', name: 'Test User' }
    const result = await localUserService.sendWelcomeEmail(user)
    expect(result).toBe(false)
    expect(global.WIKI.logger.warn).toHaveBeenCalled()
  })

  it('sendWelcomeEmail returns true when ensureMail ready', async () => {
    jest.resetModules()
    const mockSend = jest.fn().mockResolvedValue(true)
    jest.doMock('../../../core/ensure-mail', () => ({ ensureMail: () => true }))
    global.WIKI.mail = { send: mockSend, transport: {} }
    const localUserService = require('../../../graph/services/userService')
    const user = { email: 'user@example.com', name: 'Test User' }
    const result = await localUserService.sendWelcomeEmail(user)
    expect(result).toBe(true)
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com', template: 'account-welcome' }))
  })

  it('sendUserAddedToGroupEmail returns true when ensureMail ready', async () => {
    jest.resetModules()
    const mockSend = jest.fn().mockResolvedValue(true)
    jest.doMock('../../../core/ensure-mail', () => ({ ensureMail: () => true }))
    global.WIKI.mail = { send: mockSend, transport: {} }
    const localUserService = require('../../../graph/services/userService')
    const user = { email: 'member@example.com', name: 'Member' }
    const group = { name: 'GroupA', description: 'Desc' }
    const result = await localUserService.sendUserAddedToGroupEmail(user, group)
    expect(result).toBe(true)
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'member@example.com', template: 'user-added-to-group' }))
  })

  it('sendUserAddedToGroupEmail returns false when ensureMail not ready', async () => {
    jest.resetModules()
    jest.doMock('../../../core/ensure-mail', () => ({ ensureMail: () => false }))
    const localUserService = require('../../../graph/services/userService')
    const user = { email: 'member@example.com', name: 'Member' }
    const group = { name: 'GroupA', description: 'Desc' }
    const result = await localUserService.sendUserAddedToGroupEmail(user, group)
    expect(result).toBe(false)
    expect(global.WIKI.logger.warn).toHaveBeenCalled()
  })
})
