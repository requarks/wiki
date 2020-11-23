/* global WIKI */

const Model = require('objection').Model
const { DateTime } = require('luxon')
const { nanoid } = require('nanoid')

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

    this.createdAt = DateTime.utc().toISO()
  }

  static async generateToken ({ userId, kind }, context) {
    const token = await nanoid()
    await WIKI.models.userKeys.query().insert({
      kind,
      token,
      validUntil: DateTime.utc().plus({ days: 1 }).toISO(),
      userId
    })
    return token
  }

  static async validateToken ({ kind, token, skipDelete }, context) {
    const res = await WIKI.models.userKeys.query().findOne({ kind, token }).withGraphJoined('user')
    if (res) {
      if (skipDelete !== true) {
        await WIKI.models.userKeys.query().deleteById(res.id)
      }
      if (DateTime.utc() > DateTime.fromISO(res.validUntil)) {
        throw new WIKI.Error.AuthValidationTokenInvalid()
      }
      return res.user
    } else {
      throw new WIKI.Error.AuthValidationTokenInvalid()
    }
  }

  static async destroyToken ({ token }) {
    return WIKI.models.userKeys.query().findOne({ token }).delete()
  }
}
