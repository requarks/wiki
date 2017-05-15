'use strict'

const fs = require('fs')
const yaml = require('js-yaml')
const _ = require('lodash')
const path = require('path')
const cfgHelper = require('../helpers/config')

/**
 * Load Application Configuration
 *
 * @param      {Object}  confPaths  Path to the configuration files
 * @return     {Object}  Application Configuration
 */
module.exports = (confPaths) => {
  confPaths = _.defaults(confPaths, {
    config: path.join(ROOTPATH, 'config.yml'),
    data: path.join(SERVERPATH, 'app/data.yml'),
    dataRegex: path.join(SERVERPATH, 'app/regex.js')
  })

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

  // List authentication strategies

  appconfig.authStrategies = {
    list: _.filter(appconfig.auth, ['enabled', true]),
    socialEnabled: (_.chain(appconfig.auth).omit('local').filter(['enabled', true]).value().length > 0)
  }
  if (appconfig.authStrategies.list.length < 1) {
    console.error(new Error('You must enable at least 1 authentication strategy!'))
    process.exit(1)
  }

  return {
    config: appconfig,
    data: appdata
  }
}
