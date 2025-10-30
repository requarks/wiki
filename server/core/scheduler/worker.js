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

// Initialization promise to ensure jobs only run after config + mail are ready
WIKI.ready = (async () => {
  WIKI.configSvc.init()
  WIKI.logger = require('../logger').init('JOB')
  WIKI.models = require('../db').init() // initialize database only once in every worker and use it when running jobs
  try {
    if (WIKI.models && WIKI.models.onReady) {
      await WIKI.models.onReady
    }
    await WIKI.configSvc.loadFromDb()
    await WIKI.configSvc.applyFlags()
    WIKI.mail = require('../mail').init()
    if (WIKI.config && WIKI.config.mail) {
      const host = WIKI.config.mail.host
      const port = WIKI.config.mail.port
      WIKI.logger.info(`Worker mail config: host='${host}' port='${port}' secure=${WIKI.config.mail.secure} user='${WIKI.config.mail.user}'`)
    }
    if (!WIKI.mail.transport) {
      WIKI.logger.warn('Worker mail transport is NULL after init. Emails will be skipped until mail.updateConfig runs.')
    } else {
      WIKI.logger.info('Worker mail transport initialized.')
    }
  } catch (err) {
    WIKI.logger.warn(`Worker initialization encountered an issue: ${err.message}`)
  }
})()

parentPort.on('message', async (task) => {
  try {
    // Wait for initialization before executing any job
    if (WIKI.ready) {
      await WIKI.ready
    }
    const { job, data } = task
    await require(`../../jobs/${job}`)(data)
    parentPort.postMessage({ success: true })
  } catch (e) {
    parentPort.postMessage({ success: false, error: e.message })
  }
})
