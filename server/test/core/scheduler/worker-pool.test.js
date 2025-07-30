describe('WorkerPool', () => {
  function mockWorkerFactory({ emitType = 'message', exitCode, errorOnPost = false } = {}) {
    const events = require('events')
    return class MockWorker extends events.EventEmitter {
      static emitType = emitType
      constructor() {
        super()
        this.terminated = false
      }
      postMessage(data) {
        setImmediate(() => {
          if (errorOnPost) {
            this.emit('error', new Error('fail'))
          } else if (exitCode !== undefined) {
            this.emit('exit', exitCode)
          } else if (MockWorker.emitType === 'error') {
            this.emit('error', new Error('fail'))
          } else {
            this.emit('message', data + '-done')
          }
        })
      }
      terminate() {
        this.terminated = true
        return Promise.resolve()
      }
    }
  }

  function setupWorkerThreadsMock(WorkerClass) {
    jest.resetModules()
    jest.doMock('worker_threads', () => ({ Worker: WorkerClass }))
  }

  it('should initialize with correct pool size', () => {
    setupWorkerThreadsMock(mockWorkerFactory())
    const WorkerPool = require('../../../core/scheduler/worker-pool')
    const pool = new WorkerPool('mock-worker.js', 2)
    expect(pool.idleWorkers.length).toBe(2)
    expect(pool.busyWorkers.size).toBe(0)
    expect(pool.taskQueue.length).toBe(0)
  })

  it('should run a task and resolve with result', async () => {
    setupWorkerThreadsMock(mockWorkerFactory())
    const WorkerPool = require('../../../core/scheduler/worker-pool')
    const pool = new WorkerPool('mock-worker.js', 2)
    const result = await pool.runTask('foo')
    expect(result).toBe('foo-done')
    expect(pool.idleWorkers.length).toBe(2)
    expect(pool.busyWorkers.size).toBe(0)
    await pool.close()
  })

  it('should queue tasks if all workers are busy', async () => {
    setupWorkerThreadsMock(mockWorkerFactory())
    const WorkerPool = require('../../../core/scheduler/worker-pool')
    const pool = new WorkerPool('mock-worker.js', 2)
    const p1 = pool.runTask('a')
    const p2 = pool.runTask('b')
    const p3 = pool.runTask('c')
    const results = await Promise.all([p1, p2, p3])
    expect(results).toEqual(['a-done', 'b-done', 'c-done'])
    expect(pool.idleWorkers.length).toBe(2)
    expect(pool.busyWorkers.size).toBe(0)
    await pool.close()
  })

  async function testReplaceWorkerOnError() {
    const WorkerPool = require('../../../core/scheduler/worker-pool')
    const pool = new WorkerPool('mock-worker.js', 2)
    const p = pool.runTask('err')
    await expect(p).rejects.toThrow('fail')
    expect(pool.idleWorkers.length).toBe(2)
    await pool.close()
  }

  // Helper to wrap test body in jest.isolateModules and return a promise
  function runIsolatedTest(testFn) {
    return new Promise((resolve, reject) => {
      jest.isolateModules(async () => {
        try {
          await testFn()
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  it('should replace worker on error', async () => {
    setupWorkerThreadsMock(mockWorkerFactory({ errorOnPost: true, exitCode: undefined }))
    await runIsolatedTest(testReplaceWorkerOnError)
  })

  async function testReplaceWorkerOnExitNonZero() {
    const WorkerPool = require('../../../core/scheduler/worker-pool')
    const pool = new WorkerPool('mock-worker.js', 2)
    const p = pool.runTask('exit')
    await p.catch(() => {})
    expect(pool.idleWorkers.length).toBe(2)
    await pool.close()
  }

  it('should replace worker on exit with non-zero code', async () => {
    setupWorkerThreadsMock(mockWorkerFactory({ exitCode: 1, errorOnPost: false }))
    await runIsolatedTest(testReplaceWorkerOnExitNonZero)
  })

  async function testNotReplaceWorkerOnExitZero() {
    const WorkerPool = require('../../../core/scheduler/worker-pool')
    const pool = new WorkerPool('mock-worker.js', 2)
    // Overwrite postMessage to always emit exit 0 for this test
    const worker = pool.idleWorkers[0]
    worker.postMessage = function () {
      setImmediate(() => this.emit('exit', 0))
    }
    const p = pool.runTask('exit0')
    await p.catch(() => {})
    expect(pool.idleWorkers.length).toBe(2)
    await pool.close()
  }

  it('should not replace worker on exit with code 0', async () => {
    setupWorkerThreadsMock(mockWorkerFactory({ exitCode: 0, errorOnPost: false }))
    await runIsolatedTest(testNotReplaceWorkerOnExitZero)
  })

  async function testCloseAllWorkers() {
    const WorkerPool = require('../../../core/scheduler/worker-pool')
    const pool = new WorkerPool('mock-worker.js', 2)
    await pool.close()
    expect(pool.idleWorkers.length).toBe(0)
    expect(pool.busyWorkers.size).toBe(0)
  }

  it('should close all workers', async () => {
    setupWorkerThreadsMock(mockWorkerFactory())
    await runIsolatedTest(testCloseAllWorkers)
  })
})
