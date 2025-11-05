const userService = require('../../../graph/services/userService')

jest.mock('../../../graph/services/userService', () => ({
    sendUserAddedToGroupEmail: jest.fn().mockResolvedValue(true)
}))

jest.mock('../../../graph/services/userSiteInactivityService', () => ({
    handleUserSiteInactivityAfterUnassign: jest.fn().mockResolvedValue()
}))

/* global WIKI */

describe('users.update group-add email', () => {
    const createGroupsRelation = (relatedGroups) => ({
        relate: async gid => { relatedGroups.push({ id: gid, name: 'Group ' + gid }) },
        unrelate: () => ({ where: () => Promise.resolve() })
    })

    const createRelatedQueryMock = (groupsRelation) => {
        return jest.fn(rel => {
            if (rel === 'groups') {
                return groupsRelation
            }
        })
    }

    const createUserObj = (relatedQueryMock) => ({
        id: 123,
        email: 'test@example.com',
        $relatedQuery: relatedQueryMock
    })

    const createGroupsModel = () => ({
        query: () => ({
            findById: id => Promise.resolve({ id, name: 'Group ' + id }),
            join: function () { return this },
            where: function () { return Promise.resolve([]) }
        })
    })

    const createUsersModel = (userObj) => ({
        query: () => ({
            findById: () => Promise.resolve(userObj),
            patch: () => ({ findById: () => Promise.resolve() })
        })
    })

    beforeAll(() => {
        global.WIKI = global.WIKI || {}
        WIKI.config = WIKI.config || { mail: { enabled: true } }
        WIKI.logger = WIKI.logger || { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
        WIKI.models = WIKI.models || {}

        const relatedGroups = []
        const groupsRelation = createGroupsRelation(relatedGroups)
        const relatedQueryMock = createRelatedQueryMock(groupsRelation)
        const userObj = createUserObj(relatedQueryMock)

        WIKI.models.groups = createGroupsModel()
        WIKI.models.users = createUsersModel(userObj)
    })

    it('calls sendUserAddedToGroupEmail for added group IDs', async () => {
        const usersModel = require('../../../models/users')
        await usersModel.updateUser({ id: 123, groups: [10, 11] })
        expect(userService.sendUserAddedToGroupEmail).toHaveBeenCalledTimes(2)
        expect(userService.sendUserAddedToGroupEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 123 }), expect.objectContaining({ id: 10 }))
        expect(userService.sendUserAddedToGroupEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 123 }), expect.objectContaining({ id: 11 }))
    })
})
