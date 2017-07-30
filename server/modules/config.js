'use strict'

/* global wiki */

const fs = require('fs')
const yaml = require('js-yaml')
const _ = require('lodash')
const path = require('path')
const cfgHelper = require('../helpers/config')

module.exports = {
  SUBSETS: ['auth', 'features', 'git', 'logging', 'site', 'theme', 'uploads'],

  /**
   * Load root config from disk
   *
   * @param {any} confPaths
   * @returns
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

    // Check port

    if (appconfig.port < 1) {
      appconfig.port = process.env.PORT || 80
    }

  // Convert booleans

  appconfig.public = (appconfig.public === true || _.toLower(appconfig.public) === 'true')

  // List authentication strategies
    wiki.config = appconfig
    wiki.data = appdata
  },

  /**
   * Load config from DB
   *
   * @param {Array} subsets Array of subsets to load
   * @returns Promise
   */
  loadFromDb(subsets) {
    if (!_.isArray(subsets) || subsets.length === 0) {
      subsets = this.SUBSETS
    }

    return wiki.db.Setting.findAll({
      attributes: ['key', 'config'],
      where: {
        key: {
          $in: subsets
        }
      }
    }).then(results => {
      if (_.isArray(results) && results.length > 0) {
        results.forEach(result => {
          wiki.config[result.key] = result.config
        })
        return true
      } else {
        return Promise.reject(new Error('Invalid DB Configuration result set'))
      }
    })
  }
}
