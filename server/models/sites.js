const Model = require('objection').Model
const { keyBy } = require('lodash')

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
    }
    const siteId = WIKI.sitesMappings[path] || WIKI.sitesMappings['default']
    if (siteId) {
      return WIKI.sites[siteId]
    }
    return null
  }

  static async reloadCache() {
    WIKI.logger.info('Reloading site configurations...')
    const sites = await WIKI.models.sites.query().orderBy('id')
    WIKI.sites = keyBy(sites, 'id')
    WIKI.sitesMappings = {}
    for (const site of sites) {
      WIKI.sitesMappings[site.path] = site.id
    }
    WIKI.logger.info(`Loaded ${sites.length} site configurations [ OK ]`)
  }

  static async createSite(name, path) {
    const newSite = await WIKI.models.sites.query().insertAndFetch({
      name,
      isEnabled: true,
      path,
      config: {}
    });

    return newSite
  }

  static async updateSite(id, patch) {
    return WIKI.models.sites.query().findById(id).patch(patch)
  }

  static async deleteSite(id) {
    // await WIKI.models.storage.query().delete().where('siteId', id)
    return WIKI.models.sites.query().deleteById(id)
  }
}
