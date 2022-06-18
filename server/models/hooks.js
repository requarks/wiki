const Model = require('objection').Model

/* global WIKI */

/**
 * Hook model
 */
module.exports = class Hook extends Model {
  static get tableName () { return 'hooks' }

  static get jsonAttributes () {
    return ['events']
  }

  $beforeUpdate () {
    this.updatedAt = new Date()
  }

  static async createHook (data) {
    return WIKI.models.hooks.query().insertAndFetch({
      name: data.name,
      events: data.events,
      url: data.url,
      includeMetadata: data.includeMetadata,
      includeContent: data.includeContent,
      acceptUntrusted: data.acceptUntrusted,
      authHeader: data.authHeader,
      state: 'pending',
      lastErrorMessage: null
    })
  }

  static async updateHook (id, patch) {
    return WIKI.models.hooks.query().findById(id).patch({
      ...patch,
      state: 'pending',
      lastErrorMessage: null
    })
  }

  static async deleteHook (id) {
    return WIKI.models.hooks.query().deleteById(id)
  }
}
