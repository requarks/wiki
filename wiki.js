#!/usr/bin/env node
'use strict'

// ===========================================
// Wiki.js
// 1.0.0
// Licensed under AGPLv3
// ===========================================

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const ora = require('ora')
const pm2 = Promise.promisifyAll(require('pm2'))
const cmdr = require('commander')
const path = require('path')

const packageObj = fs.readJsonSync('package.json')

cmdr.version(packageObj.version)

cmdr.command('start')
  .description('Start Wiki.js process')
  .action(() => {
    let spinner = ora('Initializing...').start()
    fs.emptyDirAsync(path.join(__dirname, './logs')).then(() => {
      return pm2.connectAsync().then(() => {
        return pm2.startAsync({
          name: 'wiki',
          script: 'server.js',
          cwd: __dirname,
          output: path.join(__dirname, './logs/wiki-output.log'),
          error: path.join(__dirname, './logs/wiki-error.log'),
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
  })

cmdr.command('stop')
  .description('Stop Wiki.js process')
  .action(() => {
    let spinner = ora('Shutting down Wiki.js...').start()
    pm2.connectAsync().then(() => {
      return pm2.stopAsync('wiki').then(() => {
        spinner.succeed('Wiki.js has stopped successfully.')
      }).finally(() => {
        pm2.disconnect()
      })
    }).catch(err => {
      spinner.fail(err)
      process.exit(1)
    })
  })

cmdr.command('configure [port]')
  .description('Configure Wiki.js')
  .action((port) => {
    port = port || 3000
    let spinner = ora('Initializing interactive setup...').start()
    require('./configure')(port, spinner)
  })

cmdr.parse(process.argv)

if (!process.argv.slice(2).length) {
  cmdr.help()
}
