const { parentPort } = require('worker_threads')
const path = require('path')

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  SERVERPATH: path.join(process.cwd(), 'server'),
  Error: require('../../helpers/error'),
  configSvc: require('../config')
}
global.WIKI = WIKI

;(async () => {
  WIKI.configSvc.init()
  WIKI.logger = require('../logger').init('JOB')
  WIKI.models = require('../db').init() // initialize database only once in every worker and use it when running jobs
})()

parentPort.on('message', async (task) => {
  try {
    const { job, data } = task
    await require(`../../jobs/${job}`)(data)
    parentPort.postMessage({ success: true })
  } catch (e) {
    parentPort.postMessage({ success: false, error: e.message })
  }
})
