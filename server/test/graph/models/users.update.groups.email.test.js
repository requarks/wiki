const userService = require('../../../graph/services/userService')

jest.mock('../../../graph/services/userService', () => ({
    sendUserAddedToGroupEmail: jest.fn().mockResolvedValue(true)
}))

jest.mock('../../../graph/services/userSiteInactivityService', () => ({
    handleUserSiteInactivityAfterUnassign: jest.fn().mockResolvedValue()
}))

/* global WIKI */

describe('users.update group-add email', () => {
    let relatedGroups
    let userObj

    const createRelatedQueryMock = (groups) => {
        return jest.fn().mockImplementation(rel => {
            if (rel === 'groups') {
                return {
                    relate: async (gid) => { groups.push({ id: gid, name: 'Group ' + gid }) },
                    unrelate: () => ({ where: () => Promise.resolve() }),
                    then: (resolve) => resolve(groups)
                }
            }
        })
    }

    beforeAll(() => {
        global.WIKI = global.WIKI || {}
        WIKI.config = WIKI.config || { mail: { enabled: true } }
        WIKI.logger = WIKI.logger || { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
        WIKI.models = WIKI.models || {}
        
        relatedGroups = []
        userObj = {
            id: 123,
            email: 'test@example.com',
            $relatedQuery: createRelatedQueryMock(relatedGroups)
        }
        
        WIKI.models.groups = {
            query: () => ({ findById: (id) => Promise.resolve({ id, name: 'Group ' + id }) })
        }
        WIKI.models.users = {
            query: () => ({
                findById: () => Promise.resolve(userObj),
                patch: () => ({ findById: () => Promise.resolve() })
            })
        }
    })

    it('calls sendUserAddedToGroupEmail for added group IDs', async () => {
        const usersModel = require('../../../models/users')
        await usersModel.updateUser({ id: 123, groups: [10, 11] })
        expect(userService.sendUserAddedToGroupEmail).toHaveBeenCalledTimes(2)
        expect(userService.sendUserAddedToGroupEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 123 }), expect.objectContaining({ id: 10 }))
        expect(userService.sendUserAddedToGroupEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 123 }), expect.objectContaining({ id: 11 }))
    })
})
