'use strict'

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const pm2 = Promise.promisifyAll(require('pm2'))
const ora = require('ora')
const path = require('path')

const ROOTPATH = process.cwd()

module.exports = {
  /**
   * Detect the most appropriate start mode
   */
  startDetect: function () {
    if (process.env.WIKI_JS_HEROKU) {
      return this.startInHerokuMode()
    } else {
      return this.startInBackgroundMode()
    }
  },
  /**
   * Start in background mode
   */
  startInBackgroundMode: function () {
    let spinner = ora('Initializing...').start()
    return fs.emptyDirAsync(path.join(ROOTPATH, './logs')).then(() => {
      return pm2.connectAsync().then(() => {
        return pm2.startAsync({
          name: 'wiki',
          script: 'server',
          cwd: ROOTPATH,
          output: path.join(ROOTPATH, './logs/wiki-output.log'),
          error: path.join(ROOTPATH, './logs/wiki-error.log'),
          minUptime: 5000,
          maxRestarts: 5
        }).then(() => {
          spinner.succeed('Wiki.js has started successfully.')
        }).finally(() => {
          pm2.disconnect()
        })
      })
    }).catch(err => {
      spinner.fail(err)
      process.exit(1)
    })
  },
  /**
   * Start in Heroku mode
   */
  startInHerokuMode: function () {
    console.warn('Incorrect command on Heroku, use instead: node server')
    process.exit(1)
  },
  /**
   * Stop Wiki.js process(es)
   */
  stop () {
    let spinner = ora('Shutting down Wiki.js...').start()
    return pm2.connectAsync().then(() => {
      return pm2.stopAsync('wiki').then(() => {
        spinner.succeed('Wiki.js has stopped successfully.')
      }).finally(() => {
        pm2.disconnect()
      })
    }).catch(err => {
      spinner.fail(err)
      process.exit(1)
    })
  },
  /**
   * Restart Wiki.js process(es)
   */
  restart: function () {
    let self = this
    return self.stop().delay(1000).then(() => {
      self.startDetect()
    })
  },
  /**
   * Start the web-based configuration wizard
   *
   * @param {Number} port Port to bind the HTTP server on
   */
  configure (port) {
    port = port || 3000
    let spinner = ora('Initializing interactive setup...').start()
    require('./configure')(port, spinner)
  }
}
