const _ = require('lodash')
const configHelper = require('../../helpers/config')

module.exports = {
  registerStaticJobsFromConfig(WIKI, registerJob) {
    if (!WIKI.data?.jobs) return WIKI.logger.debug('[scheduler] No static jobs found in WIKI.data.jobs')
    WIKI.logger.debug('[scheduler] Registering static jobs from WIKI.data.jobs')
    _.forOwn(WIKI.data.jobs, (queueParams, queueName) => {
      if (WIKI.config.offline && queueParams.offlineSkip) {
        WIKI.logger.warn(`Skipping job ${queueName} because offline mode is enabled. [SKIPPED]`)
        return
      }
      registerJob({
        name: _.kebabCase(queueName),
        immediate: !!queueParams.onInit,
        schedule: configHelper.isValidDurationString(queueParams.schedule) ? queueParams.schedule : 'P1D',
        repeat: !!queueParams.repeat
      })
    })
  }
}
