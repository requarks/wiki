#!/usr/bin/env node

// ===========================================
// Wiki.js
// 2.0
// Licensed under AGPLv3
// ===========================================

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const pm2 = Promise.promisifyAll(require('pm2'))
const ora = require('ora')
const path = require('path')
const cluster = require('cluster')

const ROOTPATH = process.cwd()

const init = {
  /**
   * Start in background mode
   */
  start () {
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
    return this.stop().delay(1000).then(() => {
      this.start()
    })
  },
  dev() {
    if (cluster.isMaster) {
      const webpack = require('webpack')
      const chokidar = require('chokidar')

      global.DEV = true
      global.WP_CONFIG = require('./dev/webpack/webpack.dev.js')
      global.WP = webpack(global.WP_CONFIG)
      global.WP_DEV = {
        devMiddleware: require('webpack-dev-middleware')(global.WP, {
          publicPath: global.WP_CONFIG.output.publicPath
        }),
        hotMiddleware: require('webpack-hot-middleware')(global.WP)
      }
      global.WP_DEV.devMiddleware.waitUntilValid(() => {
        console.info('>>> Starting Wiki.js in DEVELOPER mode...')
        require('./server')

        const devWatcher = chokidar.watch('./server')
        devWatcher.on('ready', () => {
          devWatcher.on('all', () => {
            console.warn('--- >>>>>>>>>>>>>>>>>>>>>>>>>>>> ---')
            console.warn('--- Changes detected: Restarting ---')
            console.warn('--- <<<<<<<<<<<<<<<<<<<<<<<<<<<< ---')
            global.wiki.server.destroy(() => {
              global.wiki = {}
              for (const workerId in cluster.workers) {
                cluster.workers[workerId].kill()
              }
              Object.keys(require.cache).forEach(function(id) {
                if (/[/\\]server[/\\]/.test(id)) delete require.cache[id]
              })
              require('./server')
            })
          })
        })
      })
    } else {
      require('./server')
    }
  }
}

require('yargs') // eslint-disable-line no-unused-expressions
  .usage('Usage: node $0 <cmd> [args]')
  .command({
    command: 'start',
    alias: ['boot', 'init'],
    desc: 'Start Wiki.js process',
    handler: argv => {
      init.start()
    }
  })
  .command({
    command: 'stop',
    alias: ['quit', 'exit'],
    desc: 'Stop Wiki.js process',
    handler: argv => {
      init.stop()
    }
  })
  .command({
    command: 'restart',
    alias: ['reload'],
    desc: 'Restart Wiki.js process',
    handler: argv => {
      init.restart()
    }
  })
  .command({
    command: 'dev',
    desc: 'Start in Developer Mode',
    handler: argv => {
      init.dev()
    }
  })
  .recommendCommands()
  .demandCommand(1, 'You must provide one of the accepted commands above.')
  .help()
  .version()
  .epilogue('Read the docs at https://docs.requarks.io/wiki')
  .argv
