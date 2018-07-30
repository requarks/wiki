const Model = require('objection').Model
const autoload = require('auto-load')
const path = require('path')
const _ = require('lodash')

/* global WIKI */

/**
 * Editor model
 */
module.exports = class Editor extends Model {
  static get tableName() { return 'editors' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'title', 'isEnabled'],

      properties: {
        id: {type: 'integer'},
        key: {type: 'string'},
        title: {type: 'string'},
        isEnabled: {type: 'boolean'},
        config: {type: 'object'}
      }
    }
  }

  static async getEnabledEditors() {
    return WIKI.models.editors.query().where({ isEnabled: true })
  }

  static async refreshEditorsFromDisk() {
    try {
      const dbEditors = await WIKI.models.editors.query()
      const diskEditors = autoload(path.join(WIKI.SERVERPATH, 'modules/editor'))
      let newEditors = []
      _.forOwn(diskEditors, (strategy, strategyKey) => {
        if (!_.some(dbEditors, ['key', strategy.key])) {
          newEditors.push({
            key: strategy.key,
            title: strategy.title,
            isEnabled: false,
            config: _.reduce(strategy.props, (result, value, key) => {
              _.set(result, value, '')
              return result
            }, {})
          })
        }
      })
      if (newEditors.length > 0) {
        await WIKI.models.editors.query().insert(newEditors)
        WIKI.logger.info(`Loaded ${newEditors.length} new editors: [ OK ]`)
      } else {
        WIKI.logger.info(`No new editors found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new editors: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }
}
