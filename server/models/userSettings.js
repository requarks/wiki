const { Model } = require('objection')

/**
 * UserSettings Model
 *
 * Tracks user-specific settings, including whether the user has seen
 * the latest release info notification.
 */
module.exports = class UserSettings extends Model {
  static get tableName () { return 'user_settings' }
  static get idColumn () { return 'user_id' }

  // Remove strict schema validation to allow flexible inserts
  static get jsonSchema () {
    return {
      type: 'object',
      properties: {
        user_id: { type: 'integer' },
        is_release_info_seen: { type: 'boolean' }
      }
    }
  }

  static get relationMappings () {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'user_settings.user_id',
          to: 'users.id'
        }
      }
    }
  }
}
