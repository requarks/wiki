'use strict'

const _ = require('lodash')

module.exports = {
  /**
   * Parse configuration value for environment vars
   *
   * @param {any} cfg Configuration value
   * @returns Parse configuration value
   */
  parseConfigValue (cfg) {
    return _.replace(
      cfg,
      /\$\(([A-Z0-9_]+)\)/g,
      (fm, m) => { return process.env[m] }
    )
  }
}
