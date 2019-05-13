/* global WIKI */

const Model = require('objection').Model

/**
 * Users model
 */
module.exports = class AssetFolder extends Model {
  static get tableName() { return 'assetFolders' }

  static get jsonSchema () {
    return {
      type: 'object',

      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        slug: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      parent: {
        relation: Model.BelongsToOneRelation,
        modelClass: AssetFolder,
        join: {
          from: 'assetFolders.folderId',
          to: 'assetFolders.id'
        }
      }
    }
  }
}
