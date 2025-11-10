const { Model } = require('objection')

module.exports = class ReleaseNotes extends Model {
  static get tableName () { return 'release_notes' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['version_number', 'notes_en', 'notes_de'],
      properties: {
        id: { type: 'integer' },
        version_number: { type: 'string' },
        notes_en: { type: 'string' },
        notes_de: { type: 'string' }
      }
    }
  }
}
