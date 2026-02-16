
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
  const isEmptySiteId = logic.isEmptySiteId
  const deletePageTree = logic.deletePageTree
  const insertPageTree = logic.insertPageTree
  const getDefaultSiteIdIfNeeded = logic.getDefaultSiteIdIfNeeded

  beforeEach(() => {
    jest.clearAllMocks()
    mockQueryBuilder.select.mockReturnThis()
    mockQueryBuilder.where.mockReturnThis()
    mockQueryBuilder.orderBy.mockResolvedValue([])
    mockTableChain.where.mockReturnThis()
    mockTableChain.del.mockResolvedValue(1)
    mockTableChain.insert.mockResolvedValue([1])
  })

  describe('isEmptySiteId', () => {
    it('should return true for null', () => {
      expect(isEmptySiteId(null)).toBe(true)
    })

    it('should return true for undefined', () => {
      expect(isEmptySiteId(undefined)).toBe(true)
    })

    it('should return true for string "undefined"', () => {
      expect(isEmptySiteId('undefined')).toBe(true)
    })

    it('should return true for empty object', () => {
      expect(isEmptySiteId({})).toBe(true)
    })

    it('should return false for valid siteId string', () => {
      expect(isEmptySiteId('site-123')).toBe(false)
    })

    it('should return false for non-empty object', () => {
      expect(isEmptySiteId({ id: 'site-123' })).toBe(false)
    })
  })

  describe('getDefaultSiteIdIfNeeded', () => {
    it('should call getSiteIdByPath with "default"', async () => {
      await getDefaultSiteIdIfNeeded()
      expect(WIKI.models.sites.getSiteIdByPath).toHaveBeenCalledWith({
        path: 'default',
        forceReload: true
      })
    })

    it('should return the default site id', async () => {
      WIKI.models.sites.getSiteIdByPath.mockResolvedValue('default-site-123')
      const result = await getDefaultSiteIdIfNeeded()
      expect(result).toBe('default-site-123')
    })
  })

  describe('deletePageTree', () => {
    it('should delete all pageTree records when siteId is empty', async () => {
      await deletePageTree(null)
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      expect(mockTableChain.del).toHaveBeenCalled()
      expect(mockTableChain.where).not.toHaveBeenCalled()
    })

    it('should delete pageTree records for specific siteId', async () => {
      await deletePageTree('site-123')
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      expect(mockTableChain.where).toHaveBeenCalledWith('siteId', '=', 'site-123')
      expect(mockTableChain.del).toHaveBeenCalled()
    })

    it('should delete all when siteId is undefined', async () => {
      await deletePageTree(undefined)
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      expect(mockTableChain.del).toHaveBeenCalled()
      expect(mockTableChain.where).not.toHaveBeenCalled()
    })

    it('should delete all when siteId is empty object', async () => {
      await deletePageTree({})
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      expect(mockTableChain.del).toHaveBeenCalled()
      expect(mockTableChain.where).not.toHaveBeenCalled()
    })
  })

  describe('insertPageTree', () => {
    it('should not insert when tree is empty', async () => {
      await insertPageTree([])
      expect(mockKnex.table).not.toHaveBeenCalled()
    })

    it('should insert tree in chunks for postgres', async () => {
      WIKI.config.db.type = 'postgres'
      const tree = Array.from({ length: 1200 }, (_, i) => ({ id: i + 1 }))
      await insertPageTree(tree)
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      // 1200 items / 500 chunk size = 3 calls
      expect(mockTableChain.insert).toHaveBeenCalledTimes(3)
    })

    it('should insert tree in chunks for sqlite', async () => {
      WIKI.config.db.type = 'sqlite'
      const tree = Array.from({ length: 150 }, (_, i) => ({ id: i + 1 }))
      await insertPageTree(tree)
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      // 150 items / 60 chunk size = 3 calls
      expect(mockTableChain.insert).toHaveBeenCalledTimes(3)
    })

    it('should insert tree in chunks for other databases', async () => {
      WIKI.config.db.type = 'mysql'
      const tree = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }))
      await insertPageTree(tree)
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      // 250 items / 100 chunk size = 3 calls
      expect(mockTableChain.insert).toHaveBeenCalledTimes(3)
    })

    it('should insert single chunk when tree is small', async () => {
      WIKI.config.db.type = 'postgres'
      const tree = [
        { id: 1, path: 'page1' },
        { id: 2, path: 'page2' }
      ]
      await insertPageTree(tree)
      expect(mockKnex.table).toHaveBeenCalledWith('pageTree')
      expect(mockTableChain.insert).toHaveBeenCalledTimes(1)
      expect(mockTableChain.insert).toHaveBeenCalledWith(tree)
    })
  })

  describe('buildPageTree - child_position functionality', () => {
    it('should assign 0-based positions starting from 0', () => {
      const pages = [
        { id: 1, path: 'page1', localeCode: 'en', title: 'Page 1', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, [], 'default-site', false)
      // All are root-level pages, should have sequential positions
      expect(tree.find(n => n.pageId === 1).child_position).toBe(0)
    })

    it('should retain child positions when rebuild is performed', () => {
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 821, 'path': 'fruits', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 2, 'pageId': 822, 'path': 'zoo', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 3, 'pageId': 823, 'path': 'fruits/apple', 'child_position': 1, 'siteId': 'site-1' },
        { 'id': 4, 'pageId': 824, 'path': 'fruits/banana', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 5, 'pageId': 825, 'path': 'zoo/lion', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 6, 'pageId': 826, 'path': 'zoo/zebra', 'child_position': 1, 'siteId': 'site-1' }
      ]
      const pages = [
        { id: 821, path: 'fruits', localeCode: 'en', title: 'all fruits', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 822, path: 'zoo', localeCode: 'en', title: 'my zoo', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 823, path: 'fruits/apple', localeCode: 'en', title: 'apple', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 824, path: 'fruits/banana', localeCode: 'en', title: 'banana', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 825, path: 'zoo/lion', localeCode: 'en', title: 'lion', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 826, path: 'zoo/zebra', localeCode: 'en', title: 'zebra', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, 'default-site', false)
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
    })

    it('should maintain independent position sequences per parent', () => {
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 821, 'path': 'fruits', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 2, 'pageId': 822, 'path': 'zoo', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 3, 'pageId': 823, 'path': 'fruits/apple', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 5, 'pageId': 825, 'path': 'zoo/lion', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 6, 'pageId': 826, 'path': 'zoo/zebra', 'child_position': 1, 'siteId': 'site-1' }
      ]
      const pages = [
        { id: 821, path: 'fruits', localeCode: 'en', title: 'all fruits', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 822, path: 'zoo', localeCode: 'en', title: 'my zoo', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 823, path: 'fruits/apple', localeCode: 'en', title: 'apple', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 825, path: 'zoo/lion', localeCode: 'en', title: 'lion', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 826, path: 'zoo/zebra', localeCode: 'en', title: 'zebra', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 827, path: 'fruits/kiwi', localeCode: 'en', title: 'kiwi', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 828, path: 'zoo/fox', localeCode: 'en', title: 'fox', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, 'default-site', false)
      // Root level should have folders first (apple, zoo), then pages (banana, zebra)
      const rootNodes = tree.filter(n => n.parent === null)
      const fruitsNode = rootNodes.find(n => n.title === 'all fruits' && n.isFolder)
      const zooNode = rootNodes.find(n => n.title === 'my zoo' && n.isFolder)

      const fruitsChildren = tree.filter(n => n.parent === fruitsNode.id)
      const zooChildren = tree.filter(n => n.parent === zooNode.id)

      const kiwiNode = fruitsChildren.find(n => n.title === 'kiwi' && !n.isFolder)
      const foxNode = zooChildren.find(n => n.title === 'fox' && !n.isFolder)

      // assert that new pages have correct child_position within their individual parent context
      expect(kiwiNode.child_position).toBe(1)
      expect(foxNode.child_position).toBe(2)
    })

    it('should handle nested folder structure correctly', () => {
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 821, 'path': 'earth/tree/leaves/catalog', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 2, 'pageId': 822, 'path': 'earth/tree/leaves/green-leaf', 'child_position': 1, 'siteId': 'site-1' },
        { 'id': 3, 'pageId': 823, 'path': 'earth/tree/leaves/red-leaf', 'child_position': 2, 'siteId': 'site-1' }
      ]
      const pages = [
        { id: 821, path: 'earth/tree/leaves/catalog', localeCode: 'en', title: 'catalog', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 822, path: 'earth/tree/leaves/green-leaf', localeCode: 'en', title: 'green-leaf', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 823, path: 'earth/tree/leaves/red-leaf', localeCode: 'en', title: 'red-leaf', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, 'default-site', false)
      // Find the nodes under earth/tree/leaves
      const catalogNode = tree.find(n => n.title === 'catalog' && !n.isFolder)
      const greenLeafNode = tree.find(n => n.title === 'green-leaf')
      const redLeafNode = tree.find(n => n.title === 'red-leaf')
      // Under earth/tree/leaves: folder (catalog) should be first, then pages alphabetically
      expect(catalogNode.child_position).toBe(0) // folder
      expect(greenLeafNode.child_position).toBe(1) // green-leaf
      expect(redLeafNode.child_position).toBe(2) // red-leaf
    })

    it('should handle delete of pages for a site correctly', () => {
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 801, 'path': 'page1', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 2, 'pageId': 802, 'path': 'page2', 'child_position': 1, 'siteId': 'site-1' },
        { 'id': 3, 'pageId': 803, 'path': 'page3', 'child_position': 2, 'siteId': 'site-1' },
        { 'id': 4, 'pageId': 804, 'path': 'page4', 'child_position': 3, 'siteId': 'site-1' }
      ]
      const pages = [
        { id: 801, path: 'page1', localeCode: 'en', title: 'page1', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 802, path: 'page2', localeCode: 'en', title: 'page2', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 804, path: 'page4', localeCode: 'en', title: 'page4', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, 'default-site', false)
      // tree should have just 3 records
      expect(tree).toHaveLength(3)
      expect(tree.some(n => n.pageId === 803)).toBe(false)
      // Check positions are reassigned correctly
      const page1Node = tree.find(n => n.pageId === 801)
      const page2Node = tree.find(n => n.pageId === 802)
      const page4Node = tree.find(n => n.pageId === 804)
      expect(page1Node.child_position).toBe(0)
      expect(page2Node.child_position).toBe(1)
      expect(page4Node.child_position).toBe(3)
    })

    it('should assign position 0 when only one page in folder', () => {
      const pages = [
        { id: 1, path: 'parent/only-child', localeCode: 'en', title: 'only-child', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, [], 'default-site', false)
      const childNode = tree.find(n => n.pageId === 1)
      expect(childNode.child_position).toBe(0)
    })

    it('should handle empty parent (root level) correctly', () => {
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 801, 'path': 'folder/page', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 2, 'pageId': 802, 'path': 'page', 'child_position': 1, 'siteId': 'site-1' }
      ]
      const pages = [
        { id: 801, path: 'folder/page', localeCode: 'en', title: 'page', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 802, path: 'page', localeCode: 'en', title: 'page', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, 'default-site', false)
      const rootNodes = tree.filter(n => n.parent === null)
      expect(rootNodes.length).toBe(2) // folder and page
      const folderNode = rootNodes.find(n => n.isFolder)
      const pageNode = rootNodes.find(n => !n.isFolder)
      expect(folderNode.child_position).toBe(0)
      expect(pageNode.child_position).toBe(1)
    })

    it('should handle complex multi-level structure', () => {
      const pageTreeDataToRetain = [
        { 'id': 1, 'pageId': 821, 'path': 'assets', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 2, 'pageId': 822, 'path': 'docs', 'child_position': 1, 'siteId': 'site-1' },
        { 'id': 3, 'pageId': 823, 'path': 'license', 'child_position': 2, 'siteId': 'site-1' },
        { 'id': 4, 'pageId': 824, 'path': 'readme', 'child_position': 3, 'siteId': 'site-1' },
        { 'id': 5, 'pageId': 825, 'path': 'docs/api/endpoints', 'child_position': 1, 'siteId': 'site-1' },
        { 'id': 6, 'pageId': 826, 'path': 'docs/api/auth', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 7, 'pageId': 827, 'path': 'docs/api', 'child_position': 0, 'siteId': 'site-1' },
        { 'id': 8, 'pageId': 828, 'path': 'docs/intro', 'child_position': 1, 'siteId': 'site-1' }
      ]
      const pages = [
        { id: 821, path: 'assets', localeCode: 'en', title: 'assets', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 822, path: 'docs', localeCode: 'en', title: 'docs', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 827, path: 'docs/api', localeCode: 'en', title: 'api', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 828, path: 'docs/intro', localeCode: 'en', title: 'intro', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 823, path: 'license', localeCode: 'en', title: 'license', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 824, path: 'readme', localeCode: 'en', title: 'readme', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 825, path: 'docs/api/endpoints', localeCode: 'en', title: 'endpoints', isPrivate: false, privateNS: null, siteId: 'site-1' },
        { id: 826, path: 'docs/api/auth', localeCode: 'en', title: 'auth', isPrivate: false, privateNS: null, siteId: 'site-1' }
      ]
      const tree = buildPageTree(pages, pageTreeDataToRetain, 'default-site', false)
      // Root: folders (assets, docs), then pages (license, readme)
      const rootNodes = tree.filter(n => n.parent === null)
      const assetsNode = rootNodes.find(n => n.title === 'assets')
      const docsNode = rootNodes.find(n => n.title === 'docs')
      const licenseNode = rootNodes.find(n => n.title === 'license')
      const readmeNode = rootNodes.find(n => n.title === 'readme')
      expect(assetsNode.child_position).toBe(0)
      expect(docsNode.child_position).toBe(1)
      expect(licenseNode.child_position).toBe(2)
      expect(readmeNode.child_position).toBe(3)
      // Under docs: folder (api), then page (intro)
      const docsChildren = tree.filter(n => n.parent === docsNode.id)
      const apiNode = docsChildren.find(n => n.title === 'api' && n.isFolder)
      const introNode = docsChildren.find(n => n.title === 'intro')
      expect(apiNode.child_position).toBe(0)
      expect(introNode.child_position).toBe(1)
      // Under docs/api: pages alphabetically
      const apiChildren = tree.filter(n => n.parent === apiNode.id)
      const authNode = apiChildren.find(n => n.title === 'auth')
      const endpointsNode = apiChildren.find(n => n.title === 'endpoints')
      expect(authNode.child_position).toBe(0)
      expect(endpointsNode.child_position).toBe(1)
    })
  })
})
