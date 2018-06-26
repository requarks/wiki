const Model = require('objection').Model
const autoload = require('auto-load')
const path = require('path')
const _ = require('lodash')

/* global WIKI */

/**
 * Storage model
 */
module.exports = class Storage extends Model {
  static get tableName() { return 'storage' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'title', 'isEnabled'],

      properties: {
        id: {type: 'integer'},
        key: {type: 'string'},
        title: {type: 'string'},
        isEnabled: {type: 'boolean'},
        mode: {type: 'string'},
        config: {type: 'object'}
      }
    }
  }

  static async getTargets() {
    return WIKI.db.storage.query()
  }

  static async refreshTargetsFromDisk() {
    try {
      const dbTargets = await WIKI.db.storage.query()
      const diskTargets = autoload(path.join(WIKI.SERVERPATH, 'modules/storage'))
      let newTargets = []
      _.forOwn(diskTargets, (target, targetKey) => {
        if (!_.some(dbTargets, ['key', target.key])) {
          newTargets.push({
            key: target.key,
            title: target.title,
            isEnabled: false,
            mode: 'push',
            config: _.reduce(target.props, (result, value, key) => {
              _.set(result, value, '')
              return result
            }, {})
          })
        }
      })
      if (newTargets.length > 0) {
        await WIKI.db.storage.query().insert(newTargets)
        WIKI.logger.info(`Loaded ${newTargets.length} new storage targets: [ OK ]`)
      } else {
        WIKI.logger.info(`No new storage targets found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new storage providers: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }
}
