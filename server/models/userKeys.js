/* global WIKI */

const Model = require('objection').Model
const moment = require('moment')
const nanoid = require('nanoid')

/**
 * Users model
 */
module.exports = class UserKey extends Model {
  static get tableName() { return 'userKeys' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['kind', 'token', 'validUntil'],

      properties: {
        id: {type: 'integer'},
        kind: {type: 'string'},
        token: {type: 'string'},
        createdAt: {type: 'string'},
        validUntil: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'userKeys.userId',
          to: 'users.id'
        }
      }
    }
  }

  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = moment.utc().toISOString()
  }

  static async generateToken ({ userId, kind }, context) {
    const token = nanoid()
    await WIKI.models.userKeys.query().insert({
      kind,
      token,
      validUntil: moment.utc().add(1, 'days').toISOString(),
      userId
    })
    return token
  }

  static async validateToken ({ kind, token }, context) {
    const res = await WIKI.models.userKeys.query().findOne({ kind, token }).eager('user')
    if (res) {
      await WIKI.models.userKeys.query().deleteById(res.id)
      if (moment.utc().isAfter(moment.utc(res.validUntil))) {
        throw new WIKI.Error.AuthValidationTokenInvalid()
      }
      return res.user
    } else {
      throw new WIKI.Error.AuthValidationTokenInvalid()
    }
  }
}
