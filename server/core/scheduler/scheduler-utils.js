const crypto = require('crypto')
const { JOB_RETENTION_HOURS, SAFE_SEND_MAX_RETRIES, DELAY_MS_SEND_AFTER_MIN, DELAY_MS_SEND_AFTER_MAX, DELAY_MS_SAFE_SEND_RETRY } = require('./scheduler-config')
const cron = require('cron-validate').default
const configHelper = require('../../helpers/config')

module.exports = {
  calculateHash(name, data) {
    return crypto.createHash('sha256').update(JSON.stringify([name, data])).digest('hex')
  },
  /**
   * Checks if a job with the same name and hash is already queued.
   * This enforces 1 max queued job per key (hash).
   *
   * Example: If there is an active 'rebuild-tree' job running and a new page is added while 'rebuild-tree' is still running,
   * a second 'rebuild-tree' job should be queued to ensure the new page is included after the current job finishes.
   * This prevents lost updates while avoiding duplicate jobs for the same work.
   *
   * Returns true if at least one job is found in 'created' or 'retry' state.
   */
  async isAnotherJobAlreadyQueued(knex, jobName, hash, logger) {
    try {
      const queued = await knex('job')
        .where('name', jobName)
        .andWhereRaw("data->>'hash' = ?", [hash])
        .whereIn('state', ['created', 'retry'])
        .count('* as count')
        .first()
      if (!queued || typeof queued.count === 'undefined') return false
      return parseInt(queued.count) >= 1
    } catch (err) {
      logger.error(`[scheduler] Error checking job deduplication for ${jobName} with hash ${hash}:`, err)
      return false
    }
  },

  async safeSend(boss, jobName, data, logger, expireInMinutes, delay = false) {
    const options = { retentionHours: JOB_RETENTION_HOURS, expireInMinutes: expireInMinutes }
    let lastError
    for (let i = 0; i < SAFE_SEND_MAX_RETRIES; i++) {
      try {
        logger.debug(`[scheduler] Sending job ${jobName} with data:`, data)
        if (delay) {
          return await boss.sendAfter(jobName, data, options, this.getJobRequeueDelay())
        } else {
          return await boss.send(jobName, data, options)
        }
      } catch (err) {
        lastError = err
        if (err.message?.includes('deadlock detected') && i < SAFE_SEND_MAX_RETRIES - 1) {
          logger.warn(`[scheduler] Deadlock detected, retrying send for job ${jobName} (attempt ${i + 2})`)
          await new Promise(resolve => setTimeout(resolve, DELAY_MS_SAFE_SEND_RETRY))
        } else {
          throw err
        }
      }
    }
    // If we get here, all retries failed with deadlock
    throw lastError
  },

  JobDecision: Object.freeze({
    SKIP: 'SKIP',
    REQUEUE: 'REQUEUE',
    PROCEED: 'PROCEED'
  }),

  /**
   * Returns a decision for the current job based on the state of other jobs with the same name and hash.
   *
   * The decision can be:
   *   - JobDecision.PROCEED: The current job can proceed (either it is already active and is the current job, or no jobs are active).
   *   - JobDecision.SKIP: The job should be skipped because at least one is queued or retried.
   *   - JobDecision.REQUEUE: The job should be requeued for later because another is active, but none are queued/retried.
   *
   * This logic enforces that only 1 active and 1 max queued job per key (hash) are processed at a time,
   * preventing race conditions and duplicate work in parallel worker environments.
   *
   * @returns {JobDecision} One of the JobDecision enum values.
   */
  async getJobDecision(knex, jobName, hash, jobId) {
    const jobs = await knex('job')
      .where('name', jobName)
      .andWhereRaw("data->>'hash' = ?", [hash])
      .whereIn('state', ['created', 'retry', 'active'])
      .select('id', 'state')
    const activeJobs = jobs.filter(j => j.state === 'active')
    if ((activeJobs.length === 1 && activeJobs[0].id === jobId) ||
      (activeJobs.length === 0)
    ) {
      return this.JobDecision.PROCEED
    }
    const hasQueuedOrRetry = jobs.some(j => j.state === 'created' || j.state === 'retry')
    if (hasQueuedOrRetry) return this.JobDecision.SKIP
    return this.JobDecision.REQUEUE
  },

  /**
   * Returns a random integer between DELAY_MS_SEND_AFTER_MIN and DELAY_MS_SEND_AFTER_MAX (in seconds).
   * Used when requeuing jobs to introduce a random delay and prevent multiple workers from activating the same job in parallel.
   * This helps avoid race conditions in distributed/parallel worker environments.
   */
  getJobRequeueDelay() {
    const ms = crypto.randomInt(DELAY_MS_SEND_AFTER_MIN, DELAY_MS_SEND_AFTER_MAX + 1)
    return Math.floor(ms / 1000)
  },
  getScheduleType(schedule) {
    if (cron(schedule).isValid()) return 'cron'
    if (configHelper.isValidDurationString(schedule)) return 'duration'
    return 'invalid'
  },

  getTotalNumberOfConcurrentWorkers(numberOfConcurrentWorkersMap) {
    const jobCounts = Object.values(numberOfConcurrentWorkersMap || {})
    return jobCounts.length > 0 ? jobCounts.reduce((a, b) => a + b, 0) : 1
  }
}
