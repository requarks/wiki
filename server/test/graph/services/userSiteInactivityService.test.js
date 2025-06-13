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
      const mergeMock = jest.fn().mockResolvedValue(true)
      const onConflictMock = jest.fn(() => ({ merge: mergeMock }))
      const insertMock = jest.fn(() => ({ onConflict: onConflictMock }))
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
    it('should not insert inactivity if user still has access to both sites via another group', async () => {
      // Arrange
      const grp = { id: 1, rules: [{ deny: false, sites: ['siteA', 'siteB'] }] }
      const usr = { id: 42 }
      const userGroups = [
        { rules: [{ deny: false, sites: ['siteA', 'siteB'] }] }
      ]
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(userGroups)
      }))
      const mergeMock = jest.fn().mockResolvedValue(true)
      const onConflictMock = jest.fn(() => ({ merge: mergeMock }))
      const insertMock = jest.fn(() => ({ onConflict: onConflictMock }))
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        insert: insertMock
      }))

      // Act
      await userSiteInactivityService.handleUserSiteInactivityAfterUnassign(grp, usr)

      // Assert
      expect(insertMock).not.toHaveBeenCalled()
    })
    it('should not insert inactivity if user has access to siteA via two different groups', async () => {
      // Arrange
      const grp = { id: 1, rules: [{ deny: false, sites: ['siteA', 'siteB'] }] }
      const usr = { id: 42 }
      const userGroups = [
        { rules: [{ deny: false, sites: ['siteA'] }] },
        { rules: [{ deny: false, sites: ['siteA'] }] } // siteA appears in two rules
      ]
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(userGroups)
      }))
      const mergeMock = jest.fn().mockResolvedValue(true)
      const onConflictMock = jest.fn(() => ({ merge: mergeMock }))
      const insertMock = jest.fn(() => ({ onConflict: onConflictMock }))
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        insert: insertMock
      }))

      // Act
      await userSiteInactivityService.handleUserSiteInactivityAfterUnassign(grp, usr)

      // Assert
      expect(insertMock).toHaveBeenCalledWith({ userId: usr.id, siteId: 'siteB' })
      expect(insertMock).toHaveBeenCalledTimes(1)
    })
    it('should insert inactivity for both sites when user has no access to either', async () => {
      // Arrange
      const grp = { id: 1, rules: [{ deny: false, sites: ['siteA', 'siteB'] }] }
      const usr = { id: 42 }
      const userGroups = [
        { rules: [{ deny: false, sites: [] }] }
      ]
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(userGroups)
      }))
      const mergeMock = jest.fn().mockResolvedValue(true)
      const onConflictMock = jest.fn(() => ({ merge: mergeMock }))
      const insertMock = jest.fn(() => ({ onConflict: onConflictMock }))
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        insert: insertMock
      }))

      // Act
      await userSiteInactivityService.handleUserSiteInactivityAfterUnassign(grp, usr)

      // Assert
      expect(insertMock).toHaveBeenCalledWith({ userId: usr.id, siteId: 'siteA' })
      expect(insertMock).toHaveBeenCalledWith({ userId: usr.id, siteId: 'siteB' })
      expect(insertMock).toHaveBeenCalledTimes(2)
    })
    it('should not create duplicate entries for the same userId and siteId but update inactiveSince instead', async () => {
      // Arrange
      const grp = { id: 1, rules: [{ deny: false, sites: ['siteA'] }] }
      const usr = { id: 42 }
      const userGroups = [
        { rules: [{ deny: false, sites: [] }] }
      ]
      WIKI.models.groups.query = jest.fn(() => ({
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(userGroups)
      }))

      const mergeMock = jest.fn().mockResolvedValue(true)
      const onConflictMock = jest.fn(() => ({ merge: mergeMock }))
      const insertMock = jest.fn(() => ({ onConflict: onConflictMock }))
      WIKI.models.userSiteInactivity.query = jest.fn(() => ({
        insert: insertMock
      }))

      // Act
      await userSiteInactivityService.handleUserSiteInactivityAfterUnassign(grp, usr)
      await userSiteInactivityService.handleUserSiteInactivityAfterUnassign(grp, usr)

      // Assert
      expect(insertMock).toHaveBeenCalledTimes(2)
      expect(onConflictMock).toHaveBeenCalledWith(['userId', 'siteId'])
      expect(mergeMock).toHaveBeenCalledTimes(2)
    })
  })
})
