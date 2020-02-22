/* global WIKI */

const Model = require('objection').Model
const moment = require('moment')
const ms = require('ms')
const jwt = require('jsonwebtoken')

/**
 * Users model
 */
module.exports = class ApiKey extends Model {
  static get tableName() { return 'apiKeys' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name', 'key'],

      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        key: {type: 'string'},
        expiration: {type: 'string'},
        isRevoked: {type: 'boolean'},
        createdAt: {type: 'string'},
        validUntil: {type: 'string'}
      }
    }
  }

  async $beforeUpdate(opt, context) {
    await super.$beforeUpdate(opt, context)

    this.updatedAt = moment.utc().toISOString()
  }
  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = moment.utc().toISOString()
    this.updatedAt = moment.utc().toISOString()
  }

  static async createNewKey ({ name, expiration, fullAccess, group }) {
    const entry = await WIKI.models.apiKeys.query().insert({
      name,
      key: 'pending',
      expiration: moment.utc().add(ms(expiration), 'ms').toISOString(),
      isRevoked: true
    })

    const key = jwt.sign({
      api: entry.id,
      grp: fullAccess ? 1 : group
    }, {
      key: WIKI.config.certs.private,
      passphrase: WIKI.config.sessionSecret
    }, {
      algorithm: 'RS256',
      expiresIn: expiration,
      audience: WIKI.config.auth.audience,
      issuer: 'urn:wiki.js'
    })

    await WIKI.models.apiKeys.query().findById(entry.id).patch({
      key,
      isRevoked: false
    })

    return key
  }
}
