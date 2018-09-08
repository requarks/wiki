const Model = require('objection').Model
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Renderer model
 */
module.exports = class Renderer extends Model {
  static get tableName() { return 'renderers' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'},
        config: {type: 'object'}
      }
    }
  }

  static async getRenderers() {
    return WIKI.models.renderers.query()
  }

  static async refreshRenderersFromDisk() {
    let trx
    try {
      const dbRenderers = await WIKI.models.renderers.query()

      // -> Fetch definitions from disk
      const rendererDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/renderer'))
      let diskRenderers = []
      for (let dir of rendererDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/renderer', dir, 'definition.yml'), 'utf8')
        diskRenderers.push(yaml.safeLoad(def))
      }
      WIKI.data.renderers = diskRenderers.map(renderer => ({
        ...renderer,
        props: commonHelper.parseModuleProps(renderer.props)
      }))

      // -> Insert new Renderers
      let newRenderers = []
      for (let renderer of WIKI.data.renderers) {
        if (!_.some(dbRenderers, ['key', renderer.key])) {
          newRenderers.push({
            key: renderer.key,
            isEnabled: _.get(renderer, 'enabledDefault', true),
            config: _.transform(renderer.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {})
          })
        } else {
          const rendererConfig = _.get(_.find(dbRenderers, ['key', renderer.key]), 'config', {})
          await WIKI.models.renderers.query().patch({
            config: _.transform(renderer.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, rendererConfig)
          }).where('key', renderer.key)
        }
      }
      if (newRenderers.length > 0) {
        trx = await WIKI.models.Objection.transaction.start(WIKI.models.knex)
        for (let renderer of newRenderers) {
          await WIKI.models.renderers.query(trx).insert(renderer)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newRenderers.length} new renderers: [ OK ]`)
      } else {
        WIKI.logger.info(`No new renderers found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new renderers: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
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
