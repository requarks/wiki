const schedulerUtils = require('../../../core/scheduler/scheduler-utils')

describe('scheduler-utils', () => {
  const uuid1 = '8efe6eca-2d38-4686-b6e1-32511713d23e'
  const uuid2 = 'ca75e411-e45d-4b4a-809e-243015e406e0'
  let logger
  let boss

  beforeEach(() => {
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    boss = { send: jest.fn().mockResolvedValue('jobid'), sendAfter: jest.fn().mockResolvedValue('jobid') }
  })

  describe('calculateHash', () => {
    it('should return a sha256 hash for name and data', () => {
      const hash1 = schedulerUtils.calculateHash('rebuild-tree', uuid1)
      const hash2 = schedulerUtils.calculateHash('rebuild-tree', uuid1)
      const hash3 = schedulerUtils.calculateHash('rebuild-tree', uuid2)
      expect(hash1).toBe(hash2)
      expect(hash1).not.toBe(hash3)
    })
  })

  describe('isAnotherJobAlreadyQueued', () => {
    function makeKnexMockForQueued(count) {
      const mockKnex = jest.fn(() => mockKnex)
      mockKnex.where = jest.fn().mockReturnThis()
      mockKnex.andWhereRaw = jest.fn().mockReturnThis()
      mockKnex.whereIn = jest.fn().mockReturnThis()
      mockKnex.count = jest.fn().mockReturnThis()
      mockKnex.first = jest.fn().mockResolvedValue({ count: String(count) })
      return mockKnex
    }
    it('should return true if a job is already queued or retried', async () => {
      const mockKnex = makeKnexMockForQueued(1)
      const result = await schedulerUtils.isAnotherJobAlreadyQueued(mockKnex, 'rebuild-tree', 'somehash', logger)
      expect(result).toBe(true)
    })
    it('should return false if no job is queued or retried', async () => {
      const mockKnex = makeKnexMockForQueued(0)
      const result = await schedulerUtils.isAnotherJobAlreadyQueued(mockKnex, 'rebuild-tree', 'somehash', logger)
      expect(result).toBe(false)
    })
    it('should log and return false if there is an error checking for queued/retried jobs', async () => {
      const mockKnex = jest.fn(() => { throw new Error('fail') })
      const result = await schedulerUtils.isAnotherJobAlreadyQueued(mockKnex, 'rebuild-tree', 'somehash', logger)
      expect(result).toBe(false)
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('safeSend', () => {
    it('should call boss.send and return jobId', async () => {
      const jobId = await schedulerUtils.safeSend(boss, 'rebuild-tree', uuid1, logger)
      expect(jobId).toBe('jobid')
      expect(boss.send).toHaveBeenCalled()
    })
    it('should retry on deadlock and eventually throw', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => fn?.())
      const error = new Error('deadlock detected')
      boss.send = jest.fn().mockRejectedValue(error)
      await expect(schedulerUtils.safeSend(boss, 'rebuild-tree', uuid1, logger)).rejects.toThrow('deadlock detected')
      expect(boss.send).toHaveBeenCalledTimes(10)
      jest.restoreAllMocks()
    })
  })

  describe('getJobDecision', () => {
    const jobName = 'rebuild-tree'
    const hash = 'somehash'
    const jobId = 123
    let mockKnex

    function makeKnexMockForJobs(jobs) {
      const mockKnex = jest.fn(() => mockKnex)
      mockKnex.where = jest.fn().mockReturnThis()
      mockKnex.andWhereRaw = jest.fn().mockReturnThis()
      mockKnex.whereIn = jest.fn().mockReturnThis()
      mockKnex.select = jest.fn().mockResolvedValue(jobs)
      return mockKnex
    }

    it('should return PROCEED if only one active job and it matches jobId', async () => {
      mockKnex = makeKnexMockForJobs([
        { id: jobId, state: 'active' }
      ])
      const result = await schedulerUtils.getJobDecision(mockKnex, jobName, hash, jobId)
      expect(result).toBe(schedulerUtils.JobDecision.PROCEED)
    })

    it('should return PROCEED if there are no active jobs', async () => {
      mockKnex = makeKnexMockForJobs([])
      const result = await schedulerUtils.getJobDecision(mockKnex, jobName, hash, jobId)
      expect(result).toBe(schedulerUtils.JobDecision.PROCEED)
    })

    it('should return SKIP if there is a job in created state', async () => {
      mockKnex = makeKnexMockForJobs([
        { id: 1, state: 'created' },
        { id: 2, state: 'active' }
      ])
      const result = await schedulerUtils.getJobDecision(mockKnex, jobName, hash, jobId)
      expect(result).toBe(schedulerUtils.JobDecision.SKIP)
    })

    it('should return SKIP if there is a job in retry state', async () => {
      mockKnex = makeKnexMockForJobs([
        { id: 1, state: 'retry' },
        { id: 2, state: 'active' }
      ])
      const result = await schedulerUtils.getJobDecision(mockKnex, jobName, hash, jobId)
      expect(result).toBe(schedulerUtils.JobDecision.SKIP)
    })

    it('should return REQUEUE if another job is active and none are queued/retried', async () => {
      mockKnex = makeKnexMockForJobs([
        { id: 999, state: 'active' }
      ])
      const result = await schedulerUtils.getJobDecision(mockKnex, jobName, hash, jobId)
      expect(result).toBe(schedulerUtils.JobDecision.REQUEUE)
    })
  })
  describe('getScheduleType', () => {
    it('should return "cron" for a valid cron expression', () => {
      expect(schedulerUtils.getScheduleType('0 2 * * *')).toBe('cron')
    })

    it('should return "duration" for a valid ISO 8601 duration', () => {
      jest.spyOn(require('../../../helpers/config'), 'isValidDurationString').mockReturnValueOnce(true)
      expect(schedulerUtils.getScheduleType('P1D')).toBe('duration')
    })

    it('should return "invalid" for an invalid schedule', () => {
      jest.spyOn(require('../../../helpers/config'), 'isValidDurationString').mockReturnValueOnce(false)
      expect(schedulerUtils.getScheduleType('not-a-schedule')).toBe('invalid')
    })
  })
})
