import { Model } from 'objection'

/**
 * Locales model
 */
export class Locale extends Model {
  static get tableName() { return 'locales' }
  static get idColumn() { return 'code' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['code', 'name'],

      properties: {
        code: {type: 'string'},
        isRTL: {type: 'boolean', default: false},
        name: {type: 'string'},
        nativeName: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'},
        completeness: {type: 'integer'}
      }
    }
  }

  static get jsonAttributes() {
    return ['strings']
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  static async getNavLocales({ cache = false } = {}) {
    return []
    // if (!WIKI.config.lang.namespacing) {
    //   return []
    // }

    // if (cache) {
    //   const navLocalesCached = await WIKI.cache.get('nav:locales')
    //   if (navLocalesCached) {
    //     return navLocalesCached
    //   }
    // }
    // const navLocales = await WIKI.db.locales.query().select('code', 'nativeName AS name').whereIn('code', WIKI.config.lang.namespaces).orderBy('code')
    // if (navLocales) {
    //   if (cache) {
    //     await WIKI.cache.set('nav:locales', navLocales, 300)
    //   }
    //   return navLocales
    // } else {
    //   WIKI.logger.warn('Site Locales for navigation are missing or corrupted.')
    //   return []
    // }
  }
}
