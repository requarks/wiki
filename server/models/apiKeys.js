/* global WIKI */

const Model = require('objection').Model
const { DateTime } = require('luxon')
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
        id: {type: 'string'},
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

    this.updatedAt = new Date().toISOString()
  }
  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  static async createNewKey ({ name, expiration, groups }) {
    console.info(DateTime.utc().plus(ms(expiration)).toISO())

    const entry = await WIKI.models.apiKeys.query().insert({
      name,
      key: 'pending',
      expiration: DateTime.utc().plus(ms(expiration)).toISO(),
      isRevoked: true
    })

    console.info(entry)

    const key = jwt.sign({
      api: entry.id,
      grp: groups
    }, {
      key: WIKI.config.auth.certs.private,
      passphrase: WIKI.config.auth.secret
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
