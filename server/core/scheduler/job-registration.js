const _ = require('lodash')
const schedulerUtils = require('./scheduler-utils')

module.exports = {
  registerStaticJobsFromConfig(WIKI, registerJob) {
    if (!WIKI.data?.jobs) return WIKI.logger.debug('[scheduler] No static jobs found in WIKI.data.jobs')
    WIKI.logger.debug('[scheduler] Registering static jobs from WIKI.data.jobs')
    _.forOwn(WIKI.data.jobs, (queueParams, queueName) => {
      if (WIKI.config.offline && queueParams.offlineSkip) {
        WIKI.logger.warn(`Skipping job ${queueName} because offline mode is enabled. [SKIPPED]`)
        return
      }
      const scheduleType = schedulerUtils.getScheduleType(queueParams.schedule)
      registerJob({
        name: _.kebabCase(queueName),
        immediate: !!queueParams.onInit,
        schedule: (scheduleType === 'cron' || scheduleType === 'duration') ? queueParams.schedule : 'P1D',
        repeat: !!queueParams.repeat
      })
    })
  }
}
