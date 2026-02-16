
// Mock WIKI global and dependencies
const mockTableChain = {
  where: jest.fn().mockReturnThis(),
  del: jest.fn().mockResolvedValue(1),
  insert: jest.fn().mockResolvedValue([1])
}

const mockKnex = {
  table: jest.fn().mockReturnValue(mockTableChain)
}

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([])
}

const WIKI = {
  models: {
    knex: mockKnex,
    pages: {
      query: jest.fn().mockReturnValue(mockQueryBuilder)
    },
    sites: {
      getSiteIdByPath: jest.fn().mockResolvedValue('default-site-id')
    }
  },
  config: {
    db: {
      type: 'postgres'
    }
  },
  configSvc: {
    loadFromDb: jest.fn().mockResolvedValue(),
    applyFlags: jest.fn().mockResolvedValue()
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}

global.WIKI = WIKI

describe('rebuild-tree.js', () => {
  // Import the module (function object) and then access attached properties.
  const logic = require('../../jobs/rebuild-tree.js')
  const buildPageTree = logic.buildPageTree
  beforeEach(() => {
    jest.clearAllMocks()
    mockQueryBuilder.select.mockReturnThis()
    mockQueryBuilder.where.mockReturnThis()
    mockQueryBuilder.orderBy.mockResolvedValue([])
    mockTableChain.where.mockReturnThis()
    mockTableChain.del.mockResolvedValue(1)
    mockTableChain.insert.mockResolvedValue([1])
  })

  describe('add page to tree', () => {
    it('should handle add to correct site, with id starting with max id + 1', () => {
      // notice that id = 2 (with child_pos = 0) is missing (it happens when a page is deleted)
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 821, 'path': 'fruits', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 3, 'pageId': 823, 'path': 'fruits/apple', 'child_position': 1, 'siteId': 'site-1' },
        { 'id': 4, 'pageId': 824, 'path': 'fruits/banana', 'child_position': 2, 'siteId': 'site-1' },
        { 'id': 22, 'pageId': 822, 'path': 'zoo', 'child_position': 0, 'siteId': 'site-2' },
        { 'id': 55, 'pageId': 825, 'path': 'zoo/lion', 'child_position': 0, 'siteId': 'site-2' },
        { 'id': 61, 'pageId': 826, 'path': 'zoo/zebra', 'child_position': 1, 'siteId': 'site-2' }
      ]
      // add papaya page to fruits
      const pages = [
        { id: 821, path: 'fruits', localeCode: 'en', title: 'all fruits', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 823, path: 'fruits/apple', localeCode: 'en', title: 'apple', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 824, path: 'fruits/banana', localeCode: 'en', title: 'banana', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 822, path: 'zoo', localeCode: 'en', title: 'my zoo', isPrivate: false, privateNS: null, siteId: 'site-2' },
        { id: 825, path: 'zoo/lion', localeCode: 'en', title: 'lion', isPrivate: false, privateNS: null, siteId: 'site-2' },
        { id: 826, path: 'zoo/zebra', localeCode: 'en', title: 'zebra', isPrivate: false, privateNS: null, siteId: 'site-2' },
        { id: 827, path: 'fruits/papaya', localeCode: 'en', title: 'papaya', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, 'site-1', false)
      // tree should have just 7 records
      expect(tree).toHaveLength(7)
      expect(tree.some(n => n.pageId === 827)).toBe(true)
      // newly added page should have id = max id + 1
      const rootNodes = tree.filter(n => n.parent === null)
      const fruitsNode = rootNodes.find(n => n.title === 'all fruits' && n.isFolder)
      const fruitsChildren = tree.filter(n => n.parent === fruitsNode.id)
      const papayaNode = fruitsChildren.find(n => n.title === 'papaya' && !n.isFolder)
      expect(tree.some(n => n.id === 62)).toBe(true)
      // assert child pos for newly added page is incremented by 1 within its parent folder
      expect(papayaNode.child_position).toBe(3)
    })
  })
})
