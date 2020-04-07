const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * CommentProvider model
 */
module.exports = class CommentProvider extends Model {
  static get tableName() { return 'commentProviders' }
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

  static async getProvider(key) {
    return WIKI.models.commentProviders.query().findOne({ key })
  }

  static async getProviders(isEnabled) {
    const providers = await WIKI.models.commentProviders.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(providers, ['key'])
  }

  static async refreshProvidersFromDisk() {
    let trx
    try {
      const dbProviders = await WIKI.models.commentProviders.query()

      // -> Fetch definitions from disk
      const authDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/comments'))
      let diskProviders = []
      for (let dir of authDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/comments', dir, 'definition.yml'), 'utf8')
        diskProviders.push(yaml.safeLoad(def))
      }
      WIKI.data.commentProviders = diskProviders.map(engine => ({
        ...engine,
        props: commonHelper.parseModuleProps(engine.props)
      }))

      let newProviders = []
      for (let engine of WIKI.data.commentProviders) {
        if (!_.some(dbProviders, ['key', engine.key])) {
          newProviders.push({
            key: engine.key,
            isEnabled: engine.key === 'default',
            config: _.transform(engine.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {})
          })
        } else {
          const engineConfig = _.get(_.find(dbProviders, ['key', engine.key]), 'config', {})
          await WIKI.models.commentProviders.query().patch({
            config: _.transform(engine.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, engineConfig)
          }).where('key', engine.key)
        }
      }
      if (newProviders.length > 0) {
        trx = await WIKI.models.Objection.transaction.start(WIKI.models.knex)
        for (let engine of newProviders) {
          await WIKI.models.commentProviders.query(trx).insert(engine)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newProviders.length} new comment providers: [ OK ]`)
      } else {
        WIKI.logger.info(`No new comment providers found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new comment providers: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }
}
