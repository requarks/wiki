'use strict'

/* global winston */

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
    data: './app/data.yml'
  })

  let appconfig = {}
  let appdata = {}

  try {
    appconfig = yaml.safeLoad(fs.readFileSync(confPaths.config, 'utf8'))
    appdata = yaml.safeLoad(fs.readFileSync(confPaths.data, 'utf8'))
  } catch (ex) {
    winston.error(ex)
    process.exit(1)
  }

  // Merge with defaults

  appconfig = _.defaultsDeep(appconfig, appdata.defaults.config)

  // List authentication strategies

  if (appdata.capabilities.manyAuthProviders) {
    appconfig.authStrategies = {
      list: _.filter(appconfig.auth, ['enabled', true]),
      socialEnabled: (_.chain(appconfig.auth).omit('local').reject({ enabled: false }).value().length > 0)
    }
    if (appconfig.authStrategies.list.length < 1) {
      winston.error(new Error('You must enable at least 1 authentication strategy!'))
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
