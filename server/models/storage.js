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
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'},
        mode: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config', 'state']
  }

  static async getTargets() {
    return WIKI.models.storage.query()
  }

  static async refreshTargetsFromDisk() {
    let trx
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
        isAvailable: _.get(target, 'isAvailable', false),
        props: commonHelper.parseModuleProps(target.props)
      }))

      // -> Insert new targets
      let newTargets = []
      for (let target of WIKI.data.storage) {
        if (!_.some(dbTargets, ['key', target.key])) {
          newTargets.push({
            key: target.key,
            isEnabled: false,
            mode: target.defaultMode || 'push',
            syncInterval: target.schedule || 'P0D',
            config: _.transform(target.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {}),
            state: {
              status: 'pending',
              message: '',
              lastAttempt: null
            }
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
        trx = await WIKI.models.Objection.transaction.start(WIKI.models.knex)
        for (let target of newTargets) {
          await WIKI.models.storage.query(trx).insert(target)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newTargets.length} new storage targets: [ OK ]`)
      } else {
        WIKI.logger.info(`No new storage targets found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new storage providers: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }

  /**
   * Initialize active storage targets
   */
  static async initTargets() {
    this.targets = await WIKI.models.storage.query().where('isEnabled', true).orderBy('key')
    try {
      // -> Stop and delete existing jobs
      const prevjobs = _.remove(WIKI.scheduler.jobs, job => job.name === `sync-storage`)
      if (prevjobs.length > 0) {
        prevjobs.forEach(job => job.stop())
      }

      // -> Initialize targets
      for (let target of this.targets) {
        const targetDef = _.find(WIKI.data.storage, ['key', target.key])
        target.fn = require(`../modules/storage/${target.key}/storage`)
        target.fn.config = target.config
        target.fn.mode = target.mode
        try {
          await target.fn.init()

          // -> Save succeeded init state
          await WIKI.models.storage.query().patch({
            state: {
              status: 'operational',
              message: '',
              lastAttempt: new Date().toISOString()
            }
          }).where('key', target.key)

          // -> Set recurring sync job
          if (targetDef.schedule && target.syncInterval !== `P0D`) {
            WIKI.scheduler.registerJob({
              name: `sync-storage`,
              immediate: false,
              schedule: target.syncInterval,
              repeat: true
            }, target.key)
          }

          // -> Set internal recurring sync job
          if (targetDef.intervalSchedule && targetDef.intervalSchedule !== `P0D`) {
            WIKI.scheduler.registerJob({
              name: `sync-storage`,
              immediate: false,
              schedule: target.intervalSchedule,
              repeat: true
            }, target.key)
          }
        } catch (err) {
          // -> Save initialization error
          await WIKI.models.storage.query().patch({
            state: {
              status: 'error',
              message: err.message,
              lastAttempt: new Date().toISOString()
            }
          }).where('key', target.key)
        }
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  static async pageEvent({ event, page }) {
    try {
      for (let target of this.targets) {
        await target.fn[event](page)
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  static async assetEvent({ event, asset }) {
    try {
      for (let target of this.targets) {
        await target.fn[`asset${_.capitalize(event)}`](asset)
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  static async executeAction(targetKey, handler) {
    try {
      const target = _.find(this.targets, ['key', targetKey])
      if (target) {
        if (_.has(target.fn, handler)) {
          await target.fn[handler]()
        } else {
          throw new Error('Invalid Handler for Storage Target')
        }
      } else {
        throw new Error('Invalid or Inactive Storage Target')
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }
}
