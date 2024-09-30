#!/usr/bin/env node

// ===========================================
// Wiki.js DEV UTILITY
// Licensed under AGPLv3
// ===========================================

const _ = require('lodash')
const chalk = require('chalk')
const path = require('path')
const { spawn } = require('child_process')

let serverProcess = null

const init = {
  dev() {
    const webpack = require('webpack')
    const chokidar = require('chokidar')

    console.info(chalk.yellow.bold('--- ====================== ---'))
    console.info(chalk.yellow.bold('--- Wiki.js DEVELOPER MODE ---'))
    console.info(chalk.yellow.bold('--- ====================== ---'))

    global.DEV = true
    global.WP_CONFIG = require('./webpack/webpack.dev.js')
    global.WP = webpack(global.WP_CONFIG)
    global.WP_DEV = {
      devMiddleware: require('webpack-dev-middleware')(global.WP, {
        publicPath: global.WP_CONFIG.output.publicPath
      }),
      hotMiddleware: require('webpack-hot-middleware')(global.WP)
    }
    global.WP_DEV.devMiddleware.waitUntilValid(() => {
      console.info(chalk.yellow.bold('>>> Starting Wiki.js in DEVELOPER mode...'))
      this.startServer()

      process.stdin.setEncoding('utf8')
      process.stdin.on('data', data => {
        if (_.trim(data) === 'rs') {
          console.warn(chalk.yellow.bold('--- >>>>>>>>>>>>>>>>>>>>>>>> ---'))
          console.warn(chalk.yellow.bold('--- Manual restart requested ---'))
          console.warn(chalk.yellow.bold('--- <<<<<<<<<<<<<<<<<<<<<<<< ---'))
          this.reload()
        }
      })

      const devWatcher = chokidar.watch([
        './server',
        '!./server/views/master.pug'
      ], {
        cwd: process.cwd(),
        ignoreInitial: true,
        atomic: 400
      })
      devWatcher.on('ready', () => {
        devWatcher.on('all', _.debounce(() => {
          console.warn(chalk.yellow.bold('--- >>>>>>>>>>>>>>>>>>>>>>>>>>>> ---'))
          console.warn(chalk.yellow.bold('--- Changes detected: Restarting ---'))
          console.warn(chalk.yellow.bold('--- <<<<<<<<<<<<<<<<<<<<<<<<<<<< ---'))
          this.reload()
        }, 500))
      })
    })
  },
  startServer() {
    if (serverProcess) {
      console.warn(chalk.yellow('--- Stopping existing server process...'))
      serverProcess.kill()
    }

    console.info(chalk.green('--- Starting server process...'))
    const serverPath = path.join(__dirname, '../server');
    serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit', // inherit stdio to output logs to the console
      env: {
        ...process.env,
        DEV: true
      }
    })

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(chalk.red(`Server crashed with exit code ${code}`))
        console.error(chalk.red('Retrying server startup in 3 seconds...'))
        setTimeout(() => {
          this.startServer()
        }, 3000)
      }
    })

    serverProcess.on('error', (err) => {
      console.error(chalk.red(`Failed to start server: ${err.message}`))
    })
  },
  async reload() {
    console.warn(chalk.yellow('--- Stopping server...'))

    if (serverProcess) {
      serverProcess.kill()
    }

    console.info(chalk.yellow.bold('--- Restarting server...'))
    this.startServer()
  }
}

init.dev()
