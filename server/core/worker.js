const path = require('path')

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  SERVERPATH: path.join(process.cwd(), 'server'),
  Error: require('../helpers/error'),
  configSvc: require('./config')
}
global.WIKI = WIKI

WIKI.configSvc.init()
WIKI.logger = require('./logger').init('JOB')
const args = require('yargs').argv

;(async () => {
  try {
    await require(`../jobs/${args.job}`)(args.data)
    process.exit(0)
  } catch (e) {
    await new Promise(resolve => process.stderr.write(e.message, resolve))
    process.exit(1)
  }
})()
