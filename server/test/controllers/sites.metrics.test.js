const request = require('supertest')
const express = require('express')

/* global WIKI */

describe('Sites Cache Metrics Endpoint', () => {
    let app

    beforeEach(() => {
        app = express()
        app.use(express.json())

        const path = require('path')
        const SiteModel = require('../../models/sites')
        global.WIKI = {
            SERVERPATH: path.join(process.cwd(), 'server'),
            ROOTPATH: process.cwd(),
            auth: { checkAccess: jest.fn() },
            models: {
                sites: SiteModel,
                knex: { client: { pool: { numFree: () => 2, numUsed: () => 0 } } }
            },
            events: { outbound: { emit: jest.fn() } },
            logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
            config: { sitesCacheTTL: 60000, db: { type: 'postgres' }, bodyParserLimit: '1mb', sessionSecret: 'test' }
        }

        // Reset instrumentation variables
        WIKI.__sitesReloadCount = 0
        WIKI.__sitesCacheHits = 0
        WIKI.__sitesCacheMisses = 0
        WIKI.__sitesReloadIntervals = []

        // Mock DB query for sites model
        const Site = WIKI.models.sites
        Site.query = () => ({
            orderBy: () => Promise.resolve([
                { id: '1', name: 'Default', path: 'default', isEnabled: true },
                { id: '2', name: 'Alpha', path: 'alpha', isEnabled: true }
            ])
        })

        // Bring in the controller under test AFTER WIKI is set up
        const commonController = require('../../controllers/common')

        // Inject a fake user
        app.use((req, res, next) => { req.user = { id: 1, permissions: [] }; next() })
        app.use('/', commonController)
    })

    afterEach(() => {
        jest.resetModules()
    })

    it('returns 403 when user lacks permissions', async () => {
        WIKI.auth.checkAccess.mockReturnValue(false)
        const res = await request(app).get('/admin/metrics/sites-cache')
        expect(res.status).toBe(403)
        expect(res.body.error).toBe('unauthorized')
    })

    it('returns metrics with hits/misses and intervals after some access', async () => {
        WIKI.auth.checkAccess.mockReturnValue(true)
        // Trigger first load (hits/miss scenario)
        await WIKI.models.sites.getSiteByPath({ path: 'default' }) // reload + hit
        await WIKI.models.sites.getSiteByPath({ path: 'alpha' }) // hit
        await WIKI.models.sites.getSiteByPath({ path: 'missing' }) // miss
        // Force TTL expiry to create another reload interval
        WIKI.sitesCacheMeta.loadedAt = Date.now() - (WIKI.config.sitesCacheTTL + 10)
        await WIKI.models.sites.getSiteByPath({ path: 'default' }) // second reload + hit

        const res = await request(app).get('/admin/metrics/sites-cache')
        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
        expect(res.body.reloads).toBe(2)
        expect(res.body.hits).toBe(3)
        expect(res.body.misses).toBe(1)
        expect(Array.isArray(res.body.reloadIntervals)).toBe(true)
        expect(res.body.reloadIntervals.length).toBe(1)
        expect(res.body.version).toBe(2)
        expect(res.body.siteCount).toBe(2)
        expect(res.body.ttl).toBe(60000)
    })
})
