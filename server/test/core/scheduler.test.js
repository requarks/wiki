global.WIKI = {
  SERVERPATH: '',
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  config: { db: { type: 'postgres' } },
  data: {}
}

const { Scheduler } = require('../../core/scheduler')
const PgBoss = require('pg-boss')
const knexModule = require('../../core/db')
const schedulerUtils = require('../../core/scheduler/scheduler-utils')
const workerRunner = require('../../core/scheduler/worker-runner')

jest.mock('pg-boss')
jest.mock('../../core/db')

const mockKnex = jest.fn(() => mockKnex)
mockKnex.select = jest.fn().mockReturnThis()
mockKnex.where = jest.fn().mockReturnThis()
mockKnex.andWhereRaw = jest.fn().mockReturnThis()
mockKnex.whereIn = jest.fn().mockReturnThis()
mockKnex.count = jest.fn().mockReturnThis()
mockKnex.first = jest.fn().mockResolvedValue({ count: '0' })

const REBUILD_TREE = 'rebuild-tree'
const RENDER_PAGE = 'render-page'
const SANITIZE_SVG = 'sanitize-svg'
const JOB_DATA_HASH = '1fc4ebd2031c7fc204259a32ed197344534a9198969c03ddb993ae3e1b7db5e0'
const JOB_DATA = '8efe6eca-2d38-4686-b6e1-32511713d23e'

beforeEach(() => {
  knexModule.init = jest.fn(() => ({ knex: mockKnex }))
  PgBoss.mockClear()
})

describe('Scheduler class', () => {
  let scheduler
  beforeEach(() => {
    scheduler = new Scheduler()
  })

  describe('Initialization', () => {
    it('should initialize knex in init()', async () => {
      await scheduler.init()
      expect(scheduler.knex).toBe(mockKnex)
    })
  })

  describe('Deduplication', () => {
    it('should deduplicate jobs if a queued job exists', async () => {
      jest.spyOn(schedulerUtils, 'isAnotherJobAlreadyQueued').mockResolvedValueOnce(true)
      const result = await scheduler.shouldSkipJob({ immediate: true }, 'rebuild-tree', JOB_DATA_HASH)
      expect(result).toBe(true)
    })
    it('should not deduplicate if no queued job exists', async () => {
      jest.spyOn(schedulerUtils, 'isAnotherJobAlreadyQueued').mockResolvedValueOnce(false)
      const result = await scheduler.shouldSkipJob({ immediate: true }, 'rebuild-tree', JOB_DATA_HASH)
      expect(result).toBe(false)
    })
  })

  describe('Job Registration', () => {
    function setupBossAndKnex(scheduler) {
      scheduler.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobid'), schedule: jest.fn().mockResolvedValue(), work: jest.fn() }
      scheduler.knex = mockKnex
    }
    it('should call safeSend and return jobId for immediate jobs', async () => {
      setupBossAndKnex(scheduler)
      const opts = { name: REBUILD_TREE, immediate: true }
      const jobId = await scheduler.registerJob(opts, JOB_DATA)
      expect(jobId).toBe('jobid')
    })
    it('should schedule a repeating job with cron expression', async () => {
      setupBossAndKnex(scheduler)
      const opts = { name: RENDER_PAGE, repeat: true, schedule: 'P1D' }
      await scheduler.registerJob(opts, JOB_DATA)
      expect(scheduler.boss.schedule).toHaveBeenCalled()
    })
    it('should not add job to _registeredJobs if already registered', async () => {
      scheduler._registeredJobs.add(REBUILD_TREE)
      const initialSize = scheduler._registeredJobs.size
      setupBossAndKnex(scheduler)
      const opts = { name: REBUILD_TREE, immediate: true }
      await scheduler.registerJob(opts, JOB_DATA)
      expect(scheduler._registeredJobs.size).toBe(initialSize)
      expect(scheduler.boss.createQueue).not.toHaveBeenCalled()
    })
    it('should return early if job is deduplicated', async () => {
      scheduler.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobid'), work: jest.fn() }
      scheduler.knex = mockKnex
      mockKnex.first.mockResolvedValueOnce({ count: '2' })
      const opts = { name: REBUILD_TREE, immediate: true }
      const result = await scheduler.registerJob(opts, JOB_DATA)
      expect(result).toBeUndefined()
    })
    it('should throw error for unsupported ISO 8601 duration', async () => {
      scheduler.boss = { schedule: jest.fn().mockResolvedValue(), createQueue: jest.fn(), work: jest.fn() }
      scheduler.knex = mockKnex
      const opts = { name: SANITIZE_SVG, repeat: true, schedule: 'P1Y2M' }
      expect.assertions(1)
      try {
        await scheduler.registerJob(opts, JOB_DATA)
      } catch (e) {
        expect(e.message).toMatch(/This ISO 8601 duration cannot be represented as a cron expression/)
      }
    })
    it('should schedule a repeating job with a cron expression', async () => {
      scheduler.boss = { schedule: jest.fn().mockResolvedValue(), createQueue: jest.fn(), work: jest.fn() }
      scheduler.knex = mockKnex
      const opts = { name: RENDER_PAGE, repeat: true, schedule: '0 2 * * *' }
      await scheduler.registerJob(opts, JOB_DATA)
      expect(scheduler.boss.schedule).toHaveBeenCalledWith(
        RENDER_PAGE,
        '0 2 * * *',
        expect.any(Object),
        expect.objectContaining({ tz: 'Europe/Berlin' })
      )
    })
  })

  describe('Wait/Completion', () => {
    beforeEach(() => {
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => fn())
      let fakeNow = 0
      jest.spyOn(Date, 'now').mockImplementation(() => (fakeNow += 10000))
    })
    afterEach(() => {
      jest.restoreAllMocks()
    })
    it('should call waitForJobCompletion for wait option', async () => {
      const waitSpy = jest.spyOn(Scheduler, 'waitForJobCompletion').mockResolvedValue('done')
      scheduler.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobid'), work: jest.fn() }
      scheduler.knex = mockKnex
      const opts = { name: REBUILD_TREE, wait: true }
      const result = await scheduler.registerJob(opts, JOB_DATA)
      expect(waitSpy).toHaveBeenCalled()
      expect(result).toBe('done')
      waitSpy.mockRestore()
    })
    it('should resolve when job completes in waitForJobCompletion', async () => {
      const bossMock = {
        getJobById: jest.fn()
          .mockResolvedValueOnce({ state: 'active' })
          .mockResolvedValueOnce({ state: 'completed', data: 'result' }),
        createQueue: jest.fn(),
        send: jest.fn().mockResolvedValue('jobid'),
        work: jest.fn()
      }
      await expect(Scheduler.waitForJobCompletion(bossMock, REBUILD_TREE, JOB_DATA, JOB_DATA_HASH)).resolves.toBe('result')
    })
    it('should throw if job fails in waitForJobCompletion', async () => {
      const bossMock = {
        getJobById: jest.fn()
          .mockResolvedValueOnce({ state: 'active' })
          .mockResolvedValueOnce({ state: 'failed' }),
        createQueue: jest.fn(),
        send: jest.fn().mockResolvedValue('jobid'),
        work: jest.fn()
      }
      await expect(Scheduler.waitForJobCompletion(bossMock, REBUILD_TREE, JOB_DATA, JOB_DATA_HASH)).rejects.toThrow('Job failed')
    })
    it('should throw if boss.getJobById returns undefined in waitForJobCompletion', async () => {
      const bossMock = { getJobById: jest.fn().mockResolvedValue(undefined), createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobid'), work: jest.fn() }
      await expect(Scheduler.waitForJobCompletion(bossMock, REBUILD_TREE, JOB_DATA, JOB_DATA_HASH)).rejects.toThrow('Job not found')
    })
    it('should timeout quickly in waitForJobCompletion', async () => {
      const bossMock = {
        getJobById: jest.fn().mockResolvedValue({ state: 'active' }),
        createQueue: jest.fn(),
        send: jest.fn().mockResolvedValue('jobid'),
        work: jest.fn()
      }
      await expect(Scheduler.waitForJobCompletion(bossMock, REBUILD_TREE, JOB_DATA, JOB_DATA_HASH)).rejects.toThrow('Timeout waiting for job completion')
    })
  })

  describe('Concurrency', () => {
    it('should use correct numberOfConcurrentWorkers for jobName', async () => {
      const setupSpy = jest.spyOn(Scheduler, 'startConcurrentWorkers').mockImplementation(() => { })
      scheduler.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobid'), work: jest.fn() }
      scheduler.knex = mockKnex
      const opts = { name: 'rebuild-tree', immediate: true }
      await scheduler.registerJob(opts, JOB_DATA)
      expect(setupSpy).toHaveBeenCalledWith(
        scheduler.boss,
        'rebuild-tree',
        expect.any(Function),
        Scheduler.numberOfConcurrentWorkers['rebuild-tree']
      )
      setupSpy.mockRestore()
    })
    it('should call setupJobWorker only once per jobName', async () => {
      const setupSpy = jest.spyOn(Scheduler, 'setupJobWorker').mockImplementation(() => { })
      scheduler.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobid'), work: jest.fn() }
      scheduler.knex = mockKnex
      const opts = { name: 'unique-job', immediate: true }
      await scheduler.registerJob(opts, JOB_DATA)
      await scheduler.registerJob(opts, JOB_DATA)
      expect(setupSpy).toHaveBeenCalledTimes(1)
      setupSpy.mockRestore()
    })
  })

  describe('Multiple Instances', () => {
    it('should allow multiple Scheduler instances to operate independently', async () => {
      const schedulerA = new Scheduler()
      const schedulerB = new Scheduler()
      schedulerA.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidA'), work: jest.fn() }
      schedulerB.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidB'), work: jest.fn() }
      schedulerA.knex = mockKnex
      schedulerB.knex = mockKnex
      const optsA = { name: REBUILD_TREE, immediate: true }
      const optsB = { name: RENDER_PAGE, immediate: true }
      const jobIdA = await schedulerA.registerJob(optsA, JOB_DATA)
      const jobIdB = await schedulerB.registerJob(optsB, JOB_DATA)
      expect(jobIdA).toBe('jobidA')
      expect(jobIdB).toBe('jobidB')
      expect(schedulerA._registeredJobs.has(REBUILD_TREE)).toBe(true)
      expect(schedulerB._registeredJobs.has(RENDER_PAGE)).toBe(true)
    })
    it('should not run the same job with the same hash in parallel across instances', async () => {
      const schedulerA = new Scheduler()
      const schedulerB = new Scheduler()
      const bossMockA = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidA'), work: jest.fn() }
      const bossMockB = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidB'), work: jest.fn() }
      schedulerA.boss = bossMockA
      schedulerB.boss = bossMockB
      schedulerA.knex = mockKnex
      schedulerB.knex = mockKnex
      const opts = { name: REBUILD_TREE, immediate: true }
      mockKnex.first.mockResolvedValueOnce({ count: '0' })
      const jobIdA = await schedulerA.registerJob(opts, JOB_DATA)
      mockKnex.first.mockResolvedValueOnce({ count: '2' })
      const jobIdB = await schedulerB.registerJob(opts, JOB_DATA)
      expect(jobIdA).toBe('jobidA')
      expect(jobIdB).toBeUndefined()
    })
    it('should allow different jobs to run in parallel across instances', async () => {
      const schedulerA = new Scheduler()
      const schedulerB = new Scheduler()
      schedulerA.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidA'), work: jest.fn() }
      schedulerB.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidB'), work: jest.fn() }
      schedulerA.knex = mockKnex
      schedulerB.knex = mockKnex
      const optsA = { name: REBUILD_TREE, immediate: true }
      const optsB = { name: RENDER_PAGE, immediate: true }
      mockKnex.first.mockResolvedValueOnce({ count: '0' })
      mockKnex.first.mockResolvedValueOnce({ count: '0' })
      const jobIdA = await schedulerA.registerJob(optsA, JOB_DATA)
      const jobIdB = await schedulerB.registerJob(optsB, JOB_DATA)
      expect(jobIdA).toBe('jobidA')
      expect(jobIdB).toBe('jobidB')
    })
    it('should allow same job with different hashes to run in parallel', async () => {
      const schedulerA = new Scheduler()
      const schedulerB = new Scheduler()
      schedulerA.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidA'), work: jest.fn() }
      schedulerB.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidB'), work: jest.fn() }
      schedulerA.knex = mockKnex
      schedulerB.knex = mockKnex
      const opts = { name: REBUILD_TREE, immediate: true }
      mockKnex.first.mockResolvedValueOnce({ count: '0' })
      mockKnex.first.mockResolvedValueOnce({ count: '0' })
      const jobIdA = await schedulerA.registerJob(opts, JOB_DATA)
      const jobIdB = await schedulerB.registerJob(opts, 'ca75e411-e45d-4b4a-809e-243015e406e0')
      expect(jobIdA).toBe('jobidA')
      expect(jobIdB).toBe('jobidB')
    })
    it('should deduplicate jobs across instances even with rapid calls', async () => {
      const schedulerA = new Scheduler()
      const schedulerB = new Scheduler()
      schedulerA.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidA'), work: jest.fn() }
      schedulerB.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobidB'), work: jest.fn() }
      schedulerA.knex = mockKnex
      schedulerB.knex = mockKnex
      const opts = { name: REBUILD_TREE, immediate: true }
      mockKnex.first.mockResolvedValueOnce({ count: '0' })
      mockKnex.first.mockResolvedValueOnce({ count: '2' })
      const [jobIdA, jobIdB] = await Promise.all([
        schedulerA.registerJob(opts, JOB_DATA),
        schedulerB.registerJob(opts, JOB_DATA)
      ])
      expect([jobIdA, jobIdB].filter(Boolean).length).toBe(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing boss gracefully in stop()', async () => {
      const scheduler = new Scheduler()
      scheduler.boss = null
      await expect(scheduler.stop()).resolves.toBeUndefined()
    })
  })

  describe('Data argument type', () => {
    it('should handle data as a JSON object, not a single string', async () => {
      scheduler.boss = { createQueue: jest.fn(), send: jest.fn().mockResolvedValue('jobid'), work: jest.fn() }
      scheduler.knex = mockKnex
      const opts = { name: 'json-data-job', immediate: true }
      const data = { foo: 'bar', nested: { a: 1 } }
      const jobId = await scheduler.registerJob(opts, data)
      expect(jobId).toBe('jobid')
      expect(scheduler.boss.send).toHaveBeenCalledWith(
        'json-data-job',
        expect.objectContaining({ data: expect.any(Object), hash: expect.any(String) }),
        expect.objectContaining({ retentionHours: 6 })
      )
      const callArgs = scheduler.boss.send.mock.calls[0][1]
      expect(typeof callArgs.data).toBe('object')
      expect(typeof callArgs.data).not.toBe('string')
    })
  })

  describe('Scheduler.startConcurrentWorkers job handler', () => {
    let jobName
    beforeEach(() => {
      scheduler.boss = { work: jest.fn() }
      jobName = 'test-job'
      Scheduler.setupJobWorker(scheduler.boss, scheduler.knex, jobName, 1)
    })
    function runJobWithDecision(decision, job, runWorker = false) {
      schedulerUtils.getJobDecision = jest.fn().mockResolvedValue(decision)
      workerRunner.runWorkerProcess = runWorker ? jest.fn().mockResolvedValue() : jest.fn()
      schedulerUtils.safeSend = jest.fn().mockResolvedValue()
      return scheduler.boss.work.mock.calls[0][2](job)
    }
    it('should not call worker/queue for job decision "SKIP"', async () => {
      await runJobWithDecision(schedulerUtils.JobDecision.SKIP, [{ data: { hash: 'abc' }, id: 1 }])
      expect(workerRunner.runWorkerProcess).not.toHaveBeenCalled()
      expect(schedulerUtils.safeSend).not.toHaveBeenCalled()
    })
    it('should call safeSend for job decision "REQUEUE"', async () => {
      await runJobWithDecision(schedulerUtils.JobDecision.REQUEUE, [{ data: { hash: 'abc' }, id: 2 }])
      expect(schedulerUtils.safeSend).toHaveBeenCalledWith(
        scheduler.boss, jobName, { hash: 'abc' }, global.WIKI.logger, true
      )
      expect(workerRunner.runWorkerProcess).not.toHaveBeenCalled()
    })
    it('should call runWorkerProcess for job decision "PROCEED"', async () => {
      await runJobWithDecision(schedulerUtils.JobDecision.PROCEED, [{ data: { hash: 'abc', data: { foo: 'bar' } }, id: 2 }], true)
      expect(workerRunner.runWorkerProcess).toHaveBeenCalledWith(
        jobName,
        expect.arrayContaining([`--job=${jobName}`, expect.stringContaining('--data=')]),
        global.WIKI.ROOTPATH,
        global.WIKI.logger
      )
      expect(schedulerUtils.safeSend).not.toHaveBeenCalled()
    })
    it('should not add --data arg if jobData.data is empty object', async () => {
      schedulerUtils.getJobDecision = jest.fn().mockResolvedValue(schedulerUtils.JobDecision.PROCEED)
      workerRunner.runWorkerProcess = jest.fn().mockResolvedValue()
      const job = [{ data: { hash: 'abc', data: {} }, id: 4 }]
      await scheduler.boss.work.mock.calls[0][2](job)
      const args = workerRunner.runWorkerProcess.mock.calls[0][1]
      expect(args).toEqual([`--job=${jobName}`])
    })
  })
})
