const { fork } = require('child_process')
const path = require('path')

module.exports = {
  runWorkerProcess(jobName, args, rootPath, logger) {
    return new Promise((resolve, reject) => {
      const child = fork(path.join(__dirname, 'worker.js'), args, {
        cwd: rootPath,
        stdio: ['inherit', 'pipe', 'ipc']
      })
      child.on('exit', code => module.exports.handleChildExit(child, code, jobName, logger, resolve, reject))
      child.on('error', err => {
        logger.error(`[scheduler] Worker process error for job ${jobName}:`, err)
        reject(err)
      })
    })
  },

  handleChildExit(child, code, jobName, logger, resolve, reject) {
    const statusMsg = code === 0 ?
      '[scheduler] Job ' + jobName + ' completed successfully in worker process.' :
      '[scheduler] Job ' + jobName + ' failed with exit code ' + code + ' in worker process.'
    logger[code === 0 ? 'debug' : 'error'](statusMsg)
    if (code !== 0 && child.stderr) {
      let errorBuffer = ''
      child.stderr.on('data', data => {
        errorBuffer += data
      })
      child.stderr.on('end', () => {
        try {
          const parsed = JSON.parse(errorBuffer)
          logger.error(`[scheduler] Worker error object for job ${jobName}:`, parsed)
        } catch (e) {
          logger.error(`[scheduler] Worker stderr for job ${jobName}: ${errorBuffer}`)
        }
      })
    }
    code === 0 ? resolve() : reject(new Error(`Worker exited with code ${code}`))
  }
}
