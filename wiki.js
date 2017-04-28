#!/usr/bin/env node
'use strict'

// ===========================================
// Wiki.js
// 1.0.0
// Licensed under AGPLv3
// ===========================================

const init = require('./server/init')

require('yargs') // eslint-disable-line no-unused-expressions
  .usage('Usage: node $0 <cmd> [args]')
  .command({
    command: 'start',
    alias: ['boot', 'init'],
    desc: 'Start Wiki.js process',
    handler: argv => {
      init.startDetect()
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
    command: 'configure [port]',
    alias: ['config', 'conf', 'cfg', 'setup'],
    desc: 'Configure Wiki.js using the web-based setup wizard',
    builder: (yargs) => yargs.default('port', 3000),
    handler: argv => {
      init.configure(argv.port)
    }
  })
  .recommendCommands()
  .demandCommand(1, 'You must provide one of the accepted commands above.')
  .help()
  .version()
  .epilogue('Read the docs at https://wiki.requarks.io')
  .argv
