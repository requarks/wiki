const { Worker } = require('worker_threads')

class WorkerPool {
  constructor(workerPath, poolSize = 3) {
    this.workerPath = workerPath
    this.poolSize = poolSize
    this.idleWorkers = []
    this.busyWorkers = new Set()
    this.taskQueue = []
    for (let i = 0; i < poolSize; i++) {
      this.idleWorkers.push(this.createWorker())
    }
  }

  createWorker() {
    const worker = new Worker(this.workerPath)
    worker.on('message', (result) => {
      worker._resolve(result)
      this.busyWorkers.delete(worker)
      this.idleWorkers.push(worker)
      this.next()
    })
    worker.on('error', (err) => {
      worker._reject(err)
      this.busyWorkers.delete(worker)
      this.idleWorkers.push(this.createWorker())
      this.next()
    })
    worker.on('exit', (code) => {
      this.busyWorkers.delete(worker)
      if (code !== 0) {
        worker._reject(new Error(`Worker exited with code ${code}`))
        this.idleWorkers.push(this.createWorker())
      } else {
        if (typeof worker._resolve === 'function') {
          worker._resolve()
        }
        this.idleWorkers.push(worker)
      }
      this.next()
    })
    return worker
  }

  runTask(taskData) {
    return new Promise((resolve, reject) => {
      const task = { taskData, resolve, reject }
      this.taskQueue.push(task)
      this.next()
    })
  }

  next() {
    if (this.idleWorkers.length === 0 || this.taskQueue.length === 0) return
    const worker = this.idleWorkers.pop()
    const { taskData, resolve, reject } = this.taskQueue.shift()
    this.busyWorkers.add(worker)
    worker._resolve = resolve
    worker._reject = reject
    worker.postMessage(taskData)
  }

  async close() {
    const closePromises = []
    for (const worker of [...this.idleWorkers, ...this.busyWorkers]) {
      closePromises.push(new Promise((resolve) => {
        worker.terminate().then(resolve).catch(resolve)
      }))
    }
    await Promise.all(closePromises)
    this.idleWorkers = []
    this.busyWorkers.clear()
  }
}
module.exports = WorkerPool
