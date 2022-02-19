'use strict'

const _ = require('lodash')

const isoDurationReg = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/

module.exports = {
  /**
   * Parse configuration value for environment vars
   *
   * Replaces `$(ENV_VAR_NAME)` with value of `ENV_VAR_NAME` environment variable.
   *
   * Also supports defaults by if provided as `$(ENV_VAR_NAME:default)`
   *
   * @param {any} cfg Configuration value
   * @returns Parse configuration value
   */
  parseConfigValue (cfg) {
    return _.replace(
      cfg,
      /\$\(([A-Z0-9_]+)(?::(.+))?\)/g,
      (fm, m, d) => { return process.env[m] || d }
    )
  },

  isValidDurationString (val) {
    return isoDurationReg.test(val)
  }
}
