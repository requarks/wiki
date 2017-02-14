#!/usr/bin/env node
'use strict'

const fs = require('fs-extra')
const ora = require('ora')
const Promise = require('bluebird')
const pm2 = Promise.promisifyAll(require('pm2'))
const cmdr = require('commander')

const packageObj = fs.readJsonSync('package.json')

cmdr.version(packageObj.version)

cmdr.command('start')
  .description('Start Wiki.js process')
  .action(() => {
    let spinner = ora('Initializing...').start()
    pm2.connectAsync().then(() => {
      return pm2.startAsync({
        name: 'wiki',
        script: 'server.js',
        cwd: __dirname
      }).then(() => {
        spinner.succeed('Wiki.js has started successfully.')
      }).finally(() => {
        pm2.disconnect()
      })
    }).catch(err => {
      console.error(err)
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
      console.error(err)
      process.exit(1)
    })
  })

cmdr.parse(process.argv)

if (!process.argv.slice(2).length) {
  cmdr.help()
}
