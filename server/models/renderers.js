const Model = require('objection').Model
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const yaml = require('js-yaml')
const DepGraph = require('dependency-graph').DepGraph
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
        isEnabled: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getRenderers() {
    return WIKI.models.renderers.query()
  }

  static async fetchDefinitions() {
    const rendererDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/rendering'))
    let diskRenderers = []
    for (let dir of rendererDirs) {
      const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/rendering', dir, 'definition.yml'), 'utf8')
      diskRenderers.push(yaml.safeLoad(def))
    }
    WIKI.data.renderers = diskRenderers.map(renderer => ({
      ...renderer,
      props: commonHelper.parseModuleProps(renderer.props)
    }))
  }

  static async refreshRenderersFromDisk() {
    let trx
    try {
      const dbRenderers = await WIKI.models.renderers.query()

      // -> Fetch definitions from disk
      await WIKI.models.renderers.fetchDefinitions()

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

      // -> Delete removed Renderers
      for (const renderer of dbRenderers) {
        if (!_.some(WIKI.data.renderers, ['key', renderer.key])) {
          await WIKI.models.renderers.query().where('key', renderer.key).del()
          WIKI.logger.info(`Removed renderer ${renderer.key} because it is no longer present in the modules folder: [ OK ]`)
        }
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new renderers: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }

  static async getRenderingPipeline(contentType) {
    const renderersDb = await WIKI.models.renderers.query().where('isEnabled', true)
    if (renderersDb && renderersDb.length > 0) {
      const renderers = renderersDb.map(rdr => {
        const renderer = _.find(WIKI.data.renderers, ['key', rdr.key])
        return {
          ...renderer,
          config: rdr.config
        }
      })

      // Build tree
      const rawCores = _.filter(renderers, renderer => !_.has(renderer, 'dependsOn')).map(core => {
        core.children = _.filter(renderers, ['dependsOn', core.key])
        return core
      })

      // Build dependency graph
      const graph = new DepGraph({ circular: true })
      rawCores.map(core => { graph.addNode(core.key) })
      rawCores.map(core => {
        rawCores.map(coreTarget => {
          if (core.key !== coreTarget.key) {
            if (core.output === coreTarget.input) {
              graph.addDependency(core.key, coreTarget.key)
            }
          }
        })
      })

      // Filter unused cores
      let activeCoreKeys = _.filter(rawCores, ['input', contentType]).map(core => core.key)
      _.clone(activeCoreKeys).map(coreKey => {
        activeCoreKeys = _.union(activeCoreKeys, graph.dependenciesOf(coreKey))
      })
      const activeCores = _.filter(rawCores, core => _.includes(activeCoreKeys, core.key))

      // Rebuild dependency graph with active cores
      const graphActive = new DepGraph({ circular: true })
      activeCores.map(core => { graphActive.addNode(core.key) })
      activeCores.map(core => {
        activeCores.map(coreTarget => {
          if (core.key !== coreTarget.key) {
            if (core.output === coreTarget.input) {
              graphActive.addDependency(core.key, coreTarget.key)
            }
          }
        })
      })

      // Reorder cores in reverse dependency order
      let orderedCores = []
      _.reverse(graphActive.overallOrder()).map(coreKey => {
        orderedCores.push(_.find(rawCores, ['key', coreKey]))
      })

      return orderedCores
    } else {
      WIKI.logger.error(`Rendering pipeline is empty!`)
      return false
    }
  }
}
