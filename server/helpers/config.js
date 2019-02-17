'use strict'

const _ = require('lodash')

const isoDurationReg = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/

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
  },

  isValidDurationString (val) {
    return isoDurationReg.test(val)
  }
}
