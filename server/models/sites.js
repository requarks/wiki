/* global WIKI */

const Model = require('objection').Model
const { keyBy } = require('lodash')
const _ = require('lodash')

/**
 * Site model
 */
module.exports = class Site extends Model {
  static get tableName() { return 'sites' }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['path'],

      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        path: { type: 'string' },
        isEnabled: { type: 'boolean', default: false },
        createdAt: { type: 'string' }
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getSiteByPath({ path, forceReload = false }) {
    if (forceReload) {
      await WIKI.models.sites.reloadCache()
    } else {
      await WIKI.models.sites.ensureCache()
    }
    const siteId = WIKI.sitesMappings[path]
    const hit = !!siteId
    if (hit) {
      WIKI.__sitesCacheHits = (WIKI.__sitesCacheHits || 0) + 1
    } else {
      WIKI.__sitesCacheMisses = (WIKI.__sitesCacheMisses || 0) + 1
    }
    return hit ? WIKI.sites[siteId] : null
  }

  static async getSiteIdByPath({ path, forceReload = false }) {
    if (forceReload) {
      await WIKI.models.sites.reloadCache()
    } else {
      await WIKI.models.sites.ensureCache()
    }
    const siteId = WIKI.sitesMappings[path]
    if (siteId) {
      WIKI.__sitesCacheHits = (WIKI.__sitesCacheHits || 0) + 1
    } else {
      WIKI.__sitesCacheMisses = (WIKI.__sitesCacheMisses || 0) + 1
    }
    return siteId || null
  }

  static async getSiteById({ siteId, forceReload = false }) {
    if (forceReload) {
      await WIKI.models.sites.reloadCache()
    } else {
      await WIKI.models.sites.ensureCache()
    }
    const hit = !!siteId && !!WIKI.sites[siteId]
    if (hit) {
      WIKI.__sitesCacheHits = (WIKI.__sitesCacheHits || 0) + 1
    } else {
      WIKI.__sitesCacheMisses = (WIKI.__sitesCacheMisses || 0) + 1
    }
    return hit ? WIKI.sites[siteId] : null
  }

  /**
   * Ensure cache is loaded and fresh enough.
   * Default TTL: 60s. Can be tuned by setting WIKI.config.sitesCacheTTL (ms).
   */
  static async ensureCache() {
    const ttl = _.get(WIKI, 'config.sitesCacheTTL', 60000)
    if (!WIKI.sites || !WIKI.sitesCacheMeta) {
      await WIKI.models.sites.reloadCache()
      return
    }
    const age = Date.now() - WIKI.sitesCacheMeta.loadedAt
    if (age > ttl) {
      await WIKI.models.sites.reloadCache()
    }
  }

  /**
   * Reload sites cache (full table). Concurrency-safe: concurrent callers wait.
   */
  static async reloadCache() {
    if (WIKI.sitesCacheReloading) {
      // Wait for ongoing reload
      await WIKI.sitesCacheReloading
      return
    }
    let resolveLock
    WIKI.sitesCacheReloading = new Promise(resolve => { resolveLock = resolve })
    try {
      WIKI.logger.debug('Reloading site configurations...')
      // Instrumentation: count how many times a full sites cache reload occurs (dev / diagnostics only)
      WIKI.__sitesReloadCount = (WIKI.__sitesReloadCount || 0) + 1
      // Track reload interval histogram (store up to last 50 intervals)
      const now = Date.now()
      if (WIKI.sitesCacheMeta?.loadedAt) {
        const interval = now - WIKI.sitesCacheMeta.loadedAt
        if (interval >= 0) {
          WIKI.__sitesReloadIntervals = WIKI.__sitesReloadIntervals || []
          WIKI.__sitesReloadIntervals.push(interval)
          if (WIKI.__sitesReloadIntervals.length > 50) {
            WIKI.__sitesReloadIntervals.shift()
          }
        }
      }
      const sites = await WIKI.models.sites.query().orderBy('id')
      WIKI.sites = keyBy(sites, 'id')
      WIKI.sitesMappings = {}
      for (const site of sites) {
        WIKI.sitesMappings[site.path] = site.id
      }
      WIKI.sitesCacheMeta = {
        loadedAt: Date.now(),
        version: (WIKI.sitesCacheMeta?.version || 0) + 1
      }
      WIKI.logger.debug(`Loaded ${sites.length} site configurations [ OK ] v${WIKI.sitesCacheMeta.version}`)
      WIKI.events?.outbound?.emit('sitesCacheUpdated', { version: WIKI.sitesCacheMeta.version })
    } finally {
      resolveLock()
      WIKI.sitesCacheReloading = null
    }
  }

  static async createSite(name, path) {
    const newSite = await WIKI.models.sites.query().insertAndFetch({
      name,
      isEnabled: true,
      path,
      show_recent_activities: true,
      config: {}
    })
    await WIKI.models.sites.reloadCache()
    return newSite
  }

  static async updateSite(id, patch) {
    const res = await WIKI.models.sites.query().findById(id).patch(patch)
    await WIKI.models.sites.reloadCache()
    return res
  }

  static async deleteSite(id) {
    // await WIKI.models.storage.query().delete().where('siteId', id)
    const res = await WIKI.models.sites.query().deleteById(id)
    await WIKI.models.sites.reloadCache()
    return res
  }

  /**
   * Return current cache version (0 if not yet loaded).
   */
  static getCacheVersion() {
    return WIKI.sitesCacheMeta?.version || 0
  }
}
