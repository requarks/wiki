/**
 * Simple FIFO promise-based mutual exclusion lock
 */
module.exports = class Mutex {
  constructor () {
    this._chain = Promise.resolve()
  }

  /**
   * Run fn exclusively, queued FIFO behind any in-flight holder
   *
   * @param {Function} fn Async function to run under the lock
   * @returns {Promise} Result of fn
   */
  runExclusive (fn) {
    const run = this._chain.then(() => fn())
    this._chain = run.catch(() => {})
    return run
  }
}
