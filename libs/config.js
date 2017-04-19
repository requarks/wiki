'use strict'

const fs = require('fs')
const yaml = require('js-yaml')
const _ = require('lodash')

/**
 * Load Application Configuration
 *
 * @param      {Object}  confPaths  Path to the configuration files
 * @return     {Object}  Application Configuration
 */
module.exports = (confPaths) => {
  confPaths = _.defaults(confPaths, {
    config: './config.yml',
    data: './app/data.yml',
    dataRegex: '../app/regex.js'
  })

  let appconfig = {}
  let appdata = {}

  try {
    appconfig = yaml.safeLoad(fs.readFileSync(confPaths.config, 'utf8'))
    appdata = yaml.safeLoad(fs.readFileSync(confPaths.data, 'utf8'))
    appdata.regex = require(confPaths.dataRegex)
  } catch (ex) {
    console.error(ex)
    process.exit(1)
  }

  // Merge with defaults

  appconfig = _.defaultsDeep(appconfig, appdata.defaults.config)

  // Using ENV variables?

  if (appconfig.port < 1) {
    appconfig.port = process.env.PORT || 80
  }

  if (_.startsWith(appconfig.db, '$')) {
    appconfig.db = process.env[appconfig.db.slice(1)]
  }

  // List authentication strategies

  if (appdata.capabilities.manyAuthProviders) {
    appconfig.authStrategies = {
      list: _.filter(appconfig.auth, ['enabled', true]),
      socialEnabled: (_.chain(appconfig.auth).omit('local').reject({ enabled: false }).value().length > 0)
    }
    if (appconfig.authStrategies.list.length < 1) {
      console.error(new Error('You must enable at least 1 authentication strategy!'))
      process.exit(1)
    }
  } else {
    appconfig.authStrategies = {
      list: { local: { enabled: true } },
      socialEnabled: false
    }
  }

  return {
    config: appconfig,
    data: appdata
  }
}
