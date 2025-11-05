/* global WIKI */
const Site = require('../../models/sites')

// Simple in-memory mock for sites table
let mockSites = [
  { id: '1', name: 'Default', path: 'default', isEnabled: true, config: {} },
  { id: '2', name: 'Alpha', path: 'alpha', isEnabled: true, config: {} }
]

let queryCount

beforeEach(() => {
  if (!global.WIKI) global.WIKI = {}
  WIKI.logger = WIKI.logger || { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  WIKI.events = { outbound: { emit: jest.fn() } }
  WIKI.config = { sitesCacheTTL: 60000 }
  queryCount = 0
  WIKI.__getQueryCount = () => queryCount
  // Reset instrumentation counter between tests
  WIKI.__sitesReloadCount = 0
  WIKI.models = { sites: Site }
  Site.query = () => ({
    orderBy: () => { queryCount++; return Promise.resolve(mockSites) },
    findById: (id) => ({
      patch: (p) => Promise.resolve(1)
    }),
    deleteById: (id) => {
      mockSites = mockSites.filter(s => s.id !== id)
      return Promise.resolve(1)
    }
  })
  WIKI.sites = null
  WIKI.sitesCacheMeta = null
})

test('initial access loads cache once', async () => {
  const site = await Site.getSiteByPath({ path: 'default' })
  expect(site).toMatchObject({ path: 'default' })
  expect(WIKI.__getQueryCount()).toBe(1)
})

test('subsequent access within TTL does not reload', async () => {
  await Site.getSiteByPath({ path: 'default' })
  await Site.getSiteByPath({ path: 'alpha' })
  expect(WIKI.__getQueryCount()).toBe(1)
})

test('forceReload triggers additional query', async () => {
  await Site.getSiteByPath({ path: 'default' })
  await Site.getSiteByPath({ path: 'default', forceReload: true })
  expect(WIKI.__getQueryCount()).toBe(2)
})

test('updateSite invalidates and reloads cache', async () => {
  await Site.getSiteByPath({ path: 'default' }) // queryCount = 1
  const before = WIKI.__getQueryCount()
  await Site.updateSite('1', { name: 'DefaultX' }) // reloadCache triggers orderBy -> queryCount++
  expect(WIKI.__getQueryCount()).toBe(before + 1)
})

test('deleteSite invalidates cache and removes site', async () => {
  // Warm cache
  await Site.getSiteByPath({ path: 'default' }) // queryCount = 1
  const before = WIKI.__getQueryCount()
  // Delete site '2'
  await Site.deleteSite('2') // Should trigger cache reload -> queryCount++
  expect(WIKI.__getQueryCount()).toBe(before + 1)
  // Access alpha site should now yield null
  const alpha = await Site.getSiteByPath({ path: 'alpha' })
  expect(alpha).toBeNull()
})

test('reload counter increments on each full reload', async () => {
  expect(WIKI.__sitesReloadCount || 0).toBe(0)
  await Site.getSiteByPath({ path: 'default' }) // triggers first reload
  const firstCount = WIKI.__sitesReloadCount
  expect(firstCount).toBe(1)
  await Site.getSiteByPath({ path: 'default', forceReload: true }) // second reload
  expect(WIKI.__sitesReloadCount).toBe(firstCount + 1)
  // Simulate TTL expiry to force another reload without forceReload flag
  WIKI.sitesCacheMeta.loadedAt = Date.now() - (WIKI.config.sitesCacheTTL + 5)
  await Site.getSiteByPath({ path: 'default' })
  expect(WIKI.__sitesReloadCount).toBe(firstCount + 2)
})

test('concurrent initial accesses only perform one reload', async () => {
  expect(WIKI.__sitesReloadCount).toBe(0)
  const results = await Promise.all([
    Site.getSiteByPath({ path: 'default' }),
    Site.getSiteByPath({ path: 'alpha' }),
    Site.getSiteIdByPath({ path: 'default' })
  ])
  expect(results[0]).toMatchObject({ id: '1' })
  expect(WIKI.__sitesReloadCount).toBe(1)
})

test('TTL expiry triggers exactly one additional reload and increments version', async () => {
  await Site.getSiteByPath({ path: 'default' }) // first load
  const startVersion = Site.getCacheVersion()
  const startCount = WIKI.__sitesReloadCount
  // age cache beyond TTL
  WIKI.sitesCacheMeta.loadedAt = Date.now() - (WIKI.config.sitesCacheTTL + 10)
  await Site.getSiteByPath({ path: 'alpha' }) // should trigger reload
  expect(WIKI.__sitesReloadCount).toBe(startCount + 1)
  expect(Site.getCacheVersion()).toBe(startVersion + 1)
})

test('sitesCacheUpdated event emitted once per reload with correct version', async () => {
  await Site.getSiteByPath({ path: 'default' }) // first reload
  const firstVersion = Site.getCacheVersion()
  expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('sitesCacheUpdated', { version: firstVersion })
  const emitCallCount = WIKI.events.outbound.emit.mock.calls.length
  // Force reload
  await Site.getSiteByPath({ path: 'default', forceReload: true })
  const secondVersion = Site.getCacheVersion()
  expect(secondVersion).toBe(firstVersion + 1)
  expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('sitesCacheUpdated', { version: secondVersion })
  expect(WIKI.events.outbound.emit.mock.calls.length).toBe(emitCallCount + 1)
})
