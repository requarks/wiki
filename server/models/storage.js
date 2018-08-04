const Model = require('objection').Model
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Storage model
 */
module.exports = class Storage extends Model {
  static get tableName() { return 'storage' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        id: {type: 'integer'},
        key: {type: 'string'},
        isEnabled: {type: 'boolean'},
        mode: {type: 'string'},
        config: {type: 'object'}
      }
    }
  }

  static async getTargets() {
    return WIKI.models.storage.query()
  }

  static async refreshTargetsFromDisk() {
    try {
      const dbTargets = await WIKI.models.storage.query()

      // -> Fetch definitions from disk
      const storageDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/storage'))
      let diskTargets = []
      for (let dir of storageDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/storage', dir, 'definition.yml'), 'utf8')
        diskTargets.push(yaml.safeLoad(def))
      }
      WIKI.data.storage = diskTargets.map(target => ({
        ...target,
        props: commonHelper.parseModuleProps(target.props)
      }))

      // -> Insert new targets
      let newTargets = []
      for (let target of WIKI.data.storage) {
        if (!_.some(dbTargets, ['key', target.key])) {
          newTargets.push({
            key: target.key,
            isEnabled: false,
            mode: 'push',
            config: _.transform(target.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {})
          })
        } else {
          const targetConfig = _.get(_.find(dbTargets, ['key', target.key]), 'config', {})
          await WIKI.models.storage.query().patch({
            config: _.transform(target.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, targetConfig)
          }).where('key', target.key)
        }
      }
      if (newTargets.length > 0) {
        await WIKI.models.storage.query().insert(newTargets)
        WIKI.logger.info(`Loaded ${newTargets.length} new storage targets: [ OK ]`)
      } else {
        WIKI.logger.info(`No new storage targets found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new storage providers: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }

  static async pageEvent({ event, page }) {
    const targets = await WIKI.models.storage.query().where('isEnabled', true)
    if (targets && targets.length > 0) {
      _.forEach(targets, target => {
        WIKI.queue.job.syncStorage.add({
          event,
          target,
          page
        }, {
          removeOnComplete: true
        })
      })
    }
  }
}
