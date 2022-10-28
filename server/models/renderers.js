const Model = require('objection').Model
const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const yaml = require('js-yaml')
const DepGraph = require('dependency-graph').DepGraph
const commonHelper = require('../helpers/common')

/**
 * Renderer model
 */
module.exports = class Renderer extends Model {
  static get tableName() { return 'renderers' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['module', 'isEnabled'],

      properties: {
        id: {type: 'string'},
        module: {type: 'string'},
        isEnabled: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getRenderers() {
    return WIKI.db.renderers.query()
  }

  static async fetchDefinitions() {
    try {
      // -> Fetch definitions from disk
      const renderersDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/rendering'))
      WIKI.data.renderers = []
      for (const dir of renderersDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/rendering', dir, 'definition.yml'), 'utf8')
        const defParsed = yaml.load(def)
        defParsed.key = dir
        defParsed.props = commonHelper.parseModuleProps(defParsed.props)
        WIKI.data.renderers.push(defParsed)
        WIKI.logger.debug(`Loaded renderers module definition ${dir}: [ OK ]`)
      }

      WIKI.logger.info(`Loaded ${WIKI.data.renderers.length} renderers module definitions: [ OK ]`)
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load renderers providers: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }

  static async refreshRenderersFromDisk() {
    try {
      const dbRenderers = await WIKI.db.renderers.query()

      // -> Fetch definitions from disk
      await WIKI.db.renderers.fetchDefinitions()

      // -> Insert new Renderers
      const newRenderers = []
      let updatedRenderers = 0
      for (const renderer of WIKI.data.renderers) {
        if (!_.some(dbRenderers, ['module', renderer.key])) {
          newRenderers.push({
            module: renderer.key,
            isEnabled: renderer.enabledDefault ?? true,
            config: _.transform(renderer.props, (result, value, key) => {
              result[key] = value.default
              return result
            }, {})
          })
        } else {
          const rendererConfig = _.get(_.find(dbRenderers, ['module', renderer.key]), 'config', {})
          await WIKI.db.renderers.query().patch({
            config: _.transform(renderer.props, (result, value, key) => {
              if (!_.has(result, key)) {
                result[key] = value.default
              }
              return result
            }, rendererConfig)
          }).where('module', renderer.key)
          updatedRenderers++
        }
      }
      if (newRenderers.length > 0) {
        await WIKI.db.renderers.query().insert(newRenderers)
        WIKI.logger.info(`Loaded ${newRenderers.length} new renderers: [ OK ]`)
      }

      if (updatedRenderers > 0) {
        WIKI.logger.info(`Updated ${updatedRenderers} existing renderers: [ OK ]`)
      }

      // -> Delete removed Renderers
      for (const renderer of dbRenderers) {
        if (!_.some(WIKI.data.renderers, ['key', renderer.module])) {
          await WIKI.db.renderers.query().where('module', renderer.key).del()
          WIKI.logger.info(`Removed renderer ${renderer.key} because it is no longer present in the modules folder: [ OK ]`)
        }
      }
    } catch (err) {
      WIKI.logger.error('Failed to import renderers: [ FAILED ]')
      WIKI.logger.error(err)
    }
  }

  static async getRenderingPipeline(contentType) {
    const renderersDb = await WIKI.db.renderers.query().where('isEnabled', true)
    if (renderersDb && renderersDb.length > 0) {
      const renderers = renderersDb.map(rdr => {
        const renderer = _.find(WIKI.data.renderers, ['key', rdr.module])
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
