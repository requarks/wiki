const userSiteInactivityService = require('../../../graph/services/userSiteInactivityService')

const WIKI = {
  models: {
    groups: {
      query: jest.fn()
    },
    userSiteInactivity: {
      query: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(true),
        findOne: jest.fn().mockResolvedValue(null)
      }))
    }
  }
}

describe('userSiteInactivityService', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('handleUserSiteInactivityAfterUnassign', () => {
    it('should insert inactivity for sites where user has no access', async () => {
      // Arrange
      const grp = { id: 1, rules: [{ deny: false, sites: ['siteA', 'siteB'] }] }
      const usr = { id: 42 }
      const userGroups = [
        { rules: [{ deny: false, sites: ['siteA'] }] },
        { rules: [{ deny: false, sites: [] }] }
      ]

      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(userGroups)
      }))
      const insertMock = jest.fn().mockResolvedValue(true)
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        insert: insertMock
      }))

      // Act
      await userSiteInactivityService.handleUserSiteInactivityAfterUnassign(grp, usr)

      // Assert
      expect(insertMock).toHaveBeenCalledWith({
        userId: usr.id,
        siteId: 'siteB'
      })
      expect(insertMock).toHaveBeenCalledTimes(1)
    })

    it('should not insert inactivity if user still has access to all sites', async () => {
      // Arrange
      const grp = { id: 1, rules: [{ deny: false, sites: ['siteA'] }] }
      const usr = { id: 2 }
      const userGroups = [
        { rules: [{ deny: false, sites: ['siteA'] }] }
      ]
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(userGroups)
      }))
      const insertMock = jest.fn().mockResolvedValue(true)
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        insert: insertMock
      }))

      // Act
      await userSiteInactivityService.handleUserSiteInactivityAfterUnassign(grp, usr)

      // Assert
      expect(insertMock).not.toHaveBeenCalled()
    })
  })

  describe('removeUserSiteInactivityIfReactivated', () => {
    const userId = 123
    const group = {
      rules: [
        { deny: false, sites: ['siteA', 'siteB'] }
      ]
    }

    it('removes inactivity entry if user is a member again', async () => {
      // Arrange
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { rules: [{ deny: false, sites: ['siteA'] }] }
        ])
      }))
      const deleteMock = jest.fn().mockReturnThis()
      const whereMock = jest.fn().mockResolvedValue()
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        delete: deleteMock,
        where: whereMock,
        findOne: jest.fn().mockResolvedValue(null)
      }))

      // Act
      await userSiteInactivityService.removeUserSiteInactivityIfReactivated(userId, group)

      // Assert
      expect(deleteMock).toHaveBeenCalled()
      expect(whereMock).toHaveBeenCalledWith({ userId, siteId: 'siteA' })
    })

    it('returns no_action if user is not a member and inactivity is less than 3 months', async () => {
      // Arrange
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { rules: [{ deny: false, sites: ['siteC'] }] }
        ])
      }))
      const findOneMock = jest.fn().mockResolvedValue({
        inactiveSince: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() // 1 month ago
      })
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        findOne: findOneMock,
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue()
      }))

      // Act
      const result = await userSiteInactivityService.removeUserSiteInactivityIfReactivated(userId, group)

      // Assert
      expect(result).toBe('no_action')
      expect(findOneMock).toHaveBeenCalledWith({ userId, siteId: 'siteA' })
    })

    it('returns anonymized if user is not a member and inactivity is more than 3 months', async () => {
      // Arrange
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { rules: [{ deny: false, sites: ['siteC'] }] }
        ])
      }))
      const findOneMock = jest.fn().mockResolvedValue({
        inactiveSince: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString() // 100 days ago
      })
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        findOne: findOneMock,
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue()
      }))

      // Act
      const result = await userSiteInactivityService.removeUserSiteInactivityIfReactivated(userId, group)

      // Assert
      expect(result).toBe('anonymized')
      expect(findOneMock).toHaveBeenCalledWith({ userId, siteId: 'siteA' })
    })
  })
})
