const Model = require('objection').Model

/**
 * Editor model
 */
module.exports = class Editor extends Model {
  static get tableName() { return 'editors' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getEditors() {
    return WIKI.db.editors.query()
  }

  static async getDefaultEditor(contentType) {
    // TODO - hardcoded for now
    switch (contentType) {
      case 'markdown':
        return 'markdown'
      case 'html':
        return 'ckeditor'
      default:
        return 'code'
    }
  }
}
