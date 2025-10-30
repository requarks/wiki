const { Model } = require('objection')

/* global WIKI */

module.exports = class ReleaseInfo extends Model {
  static get tableName () { return 'release_info' }
  static get idColumn () { return 'version_number' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['version_number', 'release_date'],
      properties: {
        version_number: { type: 'string' },
        release_date: { type: 'string' }, // ISO date stored as DATE in DB
        display: { type: 'boolean' }
      }
    }
  }

  static get relationMappings () {
    return {
      notes: {
        relation: Model.HasManyRelation,
        modelClass: require('./releaseNotes'),
        join: {
          from: 'release_info.version_number',
          to: 'release_notes.version_number'
        }
      }
    }
  }
}
