const Model = require('objection').Model

/**
 * Groups model
 */
module.exports = class Group extends Model {
  static get tableName() { return 'groups' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name'],

      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['permissions', 'pageRules']
  }

  static get relationMappings() {
    return {
      users: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./users'),
        join: {
          from: 'groups.id',
          through: {
            from: 'userGroups.groupId',
            to: 'userGroups.userId'
          },
          to: 'users.id'
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
