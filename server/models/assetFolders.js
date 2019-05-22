const Model = require('objection').Model
const _ = require('lodash')

/* global WIKI */

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

  /**
   * Get full folder hierarchy starting from specified folder to root
   *
   * @param {Number} folderId Id of the folder
   */
  static async getHierarchy(folderId) {
    const hier = await WIKI.models.knex.withRecursive('ancestors', qb => {
      qb.select('id', 'name', 'slug', 'parentId').from('assetFolders').where('id', folderId).union(sqb => {
        sqb.select('a.id', 'a.name', 'a.slug', 'a.parentId').from('assetFolders AS a').join('ancestors', 'ancestors.parentId', 'a.id')
      })
    }).select('*').from('ancestors')
    // The ancestors are from children to grandparents, must reverse for correct path order.
    return _.reverse(hier)
  }
}
