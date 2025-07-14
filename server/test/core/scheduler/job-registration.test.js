const jobRegistration = require('../../../core/scheduler/job-registration')

jest.mock('../../../helpers/config', () => ({
  isValidDurationString: jest.fn(val => val === 'PT15M')
}))

describe('job-registration', () => {
  it('should call registerJob for each job in WIKI.data.jobs', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: {},
      data: {
        jobs: {
          'purge-uploads': { schedule: 'PT15M', repeat: true },
          'anonymize-inactive-users-job': { schedule: 'P1D', repeat: true }
        }
      }
    }
    const registerJob = jest.fn()
    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(registerJob).toHaveBeenCalledTimes(2)
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({ name: 'purge-uploads', schedule: 'PT15M', repeat: true, immediate: false }))
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({ name: 'anonymize-inactive-users-job', schedule: 'P1D', repeat: true, immediate: false }))
  })

  it('should skip jobs with offlineSkip if offline mode is enabled', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: { offline: true },
      data: {
        jobs: {
          'rebuild-tree': { offlineSkip: true, schedule: 'P1D' },
          'render-page': { schedule: 'P1D' }
        }
      }
    }
    const registerJob = jest.fn()
    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(registerJob).toHaveBeenCalledTimes(1)
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({ name: 'render-page' }))
    expect(WIKI.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping job rebuild-tree'))
  })

  it('should log if no jobs are found', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: {},
      data: {}
    }
    const registerJob = jest.fn()
    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(WIKI.logger.debug).toHaveBeenCalledWith('[scheduler] No static jobs found in WIKI.data.jobs')
  })

  it('should use kebabCase for job names', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: {},
      data: { jobs: { 'RebuildTree': { schedule: 'P1D' } } }
    }
    const registerJob = jest.fn()
    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({ name: 'rebuild-tree' }))
  })

  it('should use default schedule if not valid', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: {},
      data: { jobs: { 'rebuild-tree': { schedule: 'invalid' } } }
    }
    const registerJob = jest.fn()
    const configHelper = require('../../../helpers/config')
    configHelper.isValidDurationString.mockReturnValue(false)
    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({ schedule: 'P1D' }))
  })

  it('should call registerJob with onInit true if job has onInit flag', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: {},
      data: { jobs: { 'rebuild-tree': { schedule: 'P1D', onInit: true } } }
    }
    const registerJob = jest.fn()
    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({ name: 'rebuild-tree', immediate: true }))
  })
  it('should call registerJob with a cron expression schedule', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: {},
      data: {
        jobs: {
          'purge-page-history': { schedule: '0 2 * * *', repeat: true }
        }
      }
    }
    const registerJob = jest.fn()
    // Mock getScheduleType to return 'cron' for this cron expression
    const schedulerUtils = require('../../../core/scheduler/scheduler-utils')
    jest.spyOn(schedulerUtils, 'getScheduleType').mockReturnValue('cron')

    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({
      name: 'purge-page-history',
      schedule: '0 2 * * *',
      repeat: true
    }))
  })

  it('should call registerJob with runInMainThread if set in job config', () => {
    const WIKI = {
      logger: { debug: jest.fn(), warn: jest.fn() },
      config: {},
      data: { jobs: { 'sync-graph-updates': { schedule: 'P1D', runInMainThread: true } } }
    }
    const registerJob = jest.fn()
    jobRegistration.registerStaticJobsFromConfig(WIKI, registerJob)
    expect(registerJob).toHaveBeenCalledWith(expect.objectContaining({ name: 'sync-graph-updates', runInMainThread: true }))
  })
})
