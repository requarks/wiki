/* global wiki */

const fs = require('fs')
const yaml = require('js-yaml')
const _ = require('lodash')
const path = require('path')
const cfgHelper = require('../helpers/config')

module.exports = {
  /**
   * Load root config from disk
   */
  init() {
    let confPaths = {
      config: path.join(wiki.ROOTPATH, 'config.yml'),
      data: path.join(wiki.SERVERPATH, 'app/data.yml'),
      dataRegex: path.join(wiki.SERVERPATH, 'app/regex.js')
    }

    let appconfig = {}
    let appdata = {}

    try {
      appconfig = yaml.safeLoad(
        cfgHelper.parseConfigValue(
          fs.readFileSync(confPaths.config, 'utf8')
        )
      )
      appdata = yaml.safeLoad(fs.readFileSync(confPaths.data, 'utf8'))
      appdata.regex = require(confPaths.dataRegex)
    } catch (ex) {
      console.error(ex)
      process.exit(1)
    }

    // Merge with defaults

    appconfig = _.defaultsDeep(appconfig, appdata.defaults.config)

    if (appconfig.port < 1) {
      appconfig.port = process.env.PORT || 80
    }

    appconfig.public = (appconfig.public === true || _.toLower(appconfig.public) === 'true')

    wiki.config = appconfig
    wiki.data = appdata
    wiki.version = require(path.join(wiki.ROOTPATH, 'package.json')).version
  },

  /**
   * Load config from DB
   *
   * @param {Array} subsets Array of subsets to load
   * @returns Promise
   */
  loadFromDb(subsets) {
    if (!_.isArray(subsets) || subsets.length === 0) {
      subsets = wiki.data.configNamespaces
    }

    return wiki.db.Setting.findAll({
      attributes: ['key', 'config'],
      where: {
        key: {
          $in: subsets
        }
      }
    }).then(results => {
      if (_.isArray(results) && results.length === subsets.length) {
        results.forEach(result => {
          wiki.config[result.key] = result.config
        })
        return true
      } else {
        wiki.logger.warn('DB Configuration is empty or incomplete.')
        return false
      }
    })
  }
}
