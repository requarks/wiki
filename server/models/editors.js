const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Editor model
 */
module.exports = class Editor extends Model {
  static get tableName() { return 'editors' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        id: {type: 'integer'},
        key: {type: 'string'},
        isEnabled: {type: 'boolean'},
        config: {type: 'object'}
      }
    }
  }

  static async getEditors() {
    return WIKI.models.editors.query()
  }

  static async refreshEditorsFromDisk() {
    try {
      const dbEditors = await WIKI.models.editors.query()

      // -> Fetch definitions from disk
      const editorDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/editor'))
      let diskEditors = []
      for (let dir of editorDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/editor', dir, 'definition.yml'), 'utf8')
        diskEditors.push(yaml.safeLoad(def))
      }
      WIKI.data.editors = diskEditors.map(editor => ({
        ...editor,
        props: commonHelper.parseModuleProps(editor.props)
      }))

      // -> Insert new editors
      let newEditors = []
      for (let editor of WIKI.data.editors) {
        if (!_.some(dbEditors, ['key', editor.key])) {
          newEditors.push({
            key: editor.key,
            isEnabled: false,
            config: _.transform(editor.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {})
          })
        } else {
          const editorConfig = _.get(_.find(dbEditors, ['key', editor.key]), 'config', {})
          await WIKI.models.editors.query().patch({
            config: _.transform(editor.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, editorConfig)
          }).where('key', editor.key)
        }
      }
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
