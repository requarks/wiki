const Model = require('objection').Model

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
    return WIKI.db.hooks.query().insertAndFetch({
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
    return WIKI.db.hooks.query().findById(id).patch({
      ...patch,
      state: 'pending',
      lastErrorMessage: null
    })
  }

  static async deleteHook (id) {
    return WIKI.db.hooks.query().deleteById(id)
  }
}
