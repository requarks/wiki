const isoDurationReg =
  /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/

export default {
  /**
   * Parse configuration value for environment vars
   *
   * Replaces `$(ENV_VAR_NAME)` with value of `ENV_VAR_NAME` environment variable.
   *
   * Also supports defaults by if provided as `$(ENV_VAR_NAME:default)`
   *
   * @param cfg Configuration value
   * @returns Parse configuration value
   */
  parseConfigValue(cfg: string): string {
    return cfg.replaceAll(/\$\(([A-Z0-9_]+)(?::(.+))?\)/g, (fm: string, m: string, d: string) => {
      return process.env[m] || d
    })
  },

  isValidDurationString(val: string): boolean {
    return isoDurationReg.test(val)
  }
}
