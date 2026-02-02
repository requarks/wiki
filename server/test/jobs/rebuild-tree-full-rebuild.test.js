
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

  describe('rebuild full pageTree by retaining old child positions', () => {
    it('should handle full rebuild for all sites and remove id gaps', () => {
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 821, 'path': 'fruits', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 3, 'pageId': 823, 'path': 'fruits/apple', 'child_position': 1, 'siteId': 'site-1' },
        { 'id': 4, 'pageId': 824, 'path': 'fruits/banana', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 22, 'pageId': 822, 'path': 'zoo', 'child_position': 0, 'siteId': 'site-2' },
        { 'id': 55, 'pageId': 825, 'path': 'zoo/lion', 'child_position': 0, 'siteId': 'site-2' },
        { 'id': 61, 'pageId': 826, 'path': 'zoo/zebra', 'child_position': 1, 'siteId': 'site-2' }
      ]
      const pages = [
        { id: 821, path: 'fruits', localeCode: 'en', title: 'all fruits', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 823, path: 'fruits/apple', localeCode: 'en', title: 'apple', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 824, path: 'fruits/banana', localeCode: 'en', title: 'banana', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 822, path: 'zoo', localeCode: 'en', title: 'my zoo', isPrivate: false, privateNS: null, siteId: 'site-2' },
        { id: 825, path: 'zoo/lion', localeCode: 'en', title: 'lion', isPrivate: false, privateNS: null, siteId: 'site-2' },
        { id: 826, path: 'zoo/zebra', localeCode: 'en', title: 'zebra', isPrivate: false, privateNS: null, siteId: 'site-2' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, undefined, true)
      // Root level should have folders first (apple, zoo), then pages (banana, zebra)
      const rootNodes = tree.filter(n => n.parent === null)
      const fruitsNode = rootNodes.find(n => n.title === 'all fruits' && n.isFolder)
      const zooNode = rootNodes.find(n => n.title === 'my zoo' && n.isFolder)

      const fruitsChildren = tree.filter(n => n.parent === fruitsNode.id)
      const zooChildren = tree.filter(n => n.parent === zooNode.id)

      const appleNode = fruitsChildren.find(n => n.title === 'apple' && !n.isFolder)
      const bananaNode = fruitsChildren.find(n => n.title === 'banana' && !n.isFolder)
      const lionNode = zooChildren.find(n => n.title === 'lion' && !n.isFolder)
      const zebraNode = zooChildren.find(n => n.title === 'zebra' && !n.isFolder)

      expect(fruitsNode.child_position).toBe(0)
      expect(zooNode.child_position).toBe(0)
      expect(bananaNode.child_position).toBe(0)
      expect(appleNode.child_position).toBe(1)
      expect(lionNode.child_position).toBe(0)
      expect(zebraNode.child_position).toBe(1)

      // assert id gaps have been removed
      expect(fruitsNode.id).toBe(1)
      expect(appleNode.id).toBe(2)
      expect(bananaNode.id).toBe(3)
      expect(zooNode.id).toBe(4)
      expect(lionNode.id).toBe(5)
      expect(zebraNode.id).toBe(6)
    })
  })
})
