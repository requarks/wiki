const Model = require('objection').Model

/**
 * Tags model
 */
module.exports = class Tag extends Model {
  static get tableName() { return 'tags' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['tag'],

      properties: {
        id: {type: 'integer'},
        tag: {type: 'string'},
        title: {type: 'string'},

        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      pages: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./pages'),
        join: {
          from: 'tags.id',
          through: {
            from: 'pageTags.tagId',
            to: 'pageTags.pageId'
          },
          to: 'pages.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
}
