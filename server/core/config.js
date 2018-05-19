const _ = require('lodash')
const cfgHelper = require('../helpers/config')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

/* global WIKI */

module.exports = {
  /**
   * Load root config from disk
   */
  init() {
    let confPaths = {
      config: path.join(WIKI.ROOTPATH, 'config.yml'),
      data: path.join(WIKI.SERVERPATH, 'app/data.yml'),
      dataRegex: path.join(WIKI.SERVERPATH, 'app/regex.js')
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

    WIKI.config = appconfig
    WIKI.data = appdata
    WIKI.version = require(path.join(WIKI.ROOTPATH, 'package.json')).version
  },

  /**
   * Load config from DB
   *
   * @param {Array} subsets Array of subsets to load
   * @returns Promise
   */
  async loadFromDb(subsets) {
    if (!_.isArray(subsets) || subsets.length === 0) {
      subsets = WIKI.data.configNamespaces
    }

    let results = await WIKI.db.settings.query().select(['key', 'value']).whereIn('key', subsets)
    if (_.isArray(results) && results.length === subsets.length) {
      results.forEach(result => {
        WIKI.config[result.key] = result.value
      })
      return true
    } else {
      WIKI.logger.warn('DB Configuration is empty or incomplete.')
      return false
    }
  },
  /**
   * Save config to DB
   *
   * @param {Array} subsets Array of subsets to save
   * @returns Promise
   */
  async saveToDb(subsets) {
    if (!_.isArray(subsets) || subsets.length === 0) {
      subsets = WIKI.data.configNamespaces
    }

    let trx = await WIKI.db.Objection.transaction.start(WIKI.db.knex)

    try {
      for (let set of subsets) {
        console.info(set)
        await WIKI.db.settings.query(trx).patch({
          value: _.get(WIKI.config, set, {})
        }).where('key', set)
      }
      await trx.commit()
    } catch (err) {
      await trx.rollback(err)
      WIKI.logger.error(`Failed to save configuration to DB: ${err.message}`)
      return false
    }

    return true
  }
}
