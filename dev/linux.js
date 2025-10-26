#!/usr/bin/env node

// ===========================================
// Wiki.js DEV UTILITY
// Licensed under AGPLv3
// ===========================================

const _ = require('lodash')
const chalk = require('chalk')

const init = {
  dev() {
    const webpack = require('webpack')
    const chokidar = require('chokidar')

    console.info(chalk.yellow.bold('--- ====================== ---'))
    console.info(chalk.yellow.bold('--- Wiki.js DEVELOPER MODE ---'))
    console.info(chalk.yellow.bold('--- ====================== ---'))

    global.DEV = true
    global.WP_CONFIG = require('./webpack/webpack.dev-linux.js')
    global.WP = webpack(global.WP_CONFIG)
    const WebpackDevMiddleware = require('webpack-dev-middleware');
    const WebpackHotMiddleware = require('webpack-hot-middleware');
    global.WP_DEV = {
      devMiddleware: WebpackDevMiddleware(global.WP, {
        publicPath: global.WP_CONFIG.output.publicPath
      }),
      hotMiddleware: WebpackHotMiddleware(global.WP)
    };
    if (typeof global.WP_DEV.devMiddleware.waitUntilValid === 'function') {
      global.WP_DEV.devMiddleware.waitUntilValid(() => {
        console.info(chalk.yellow.bold('>>> Starting Wiki.js in DEVELOPER mode...'));
        require('../server');

        process.stdin.setEncoding('utf8');
        process.stdin.on('data', data => {
          if (_.trim(data) === 'rs') {
            console.warn(chalk.yellow.bold('--- >>>>>>>>>>>>>>>>>>>>>>>> ---'));
            console.warn(chalk.yellow.bold('--- Manual restart requested ---'));
            console.warn(chalk.yellow.bold('--- <<<<<<<<<<<<<<<<<<<<<<<< ---'));
            this.reload();
          }
        });

        const devWatcher = chokidar.watch([
          './server',
          '!./server/views/master.pug'
        ], {
          cwd: process.cwd(),
          ignoreInitial: true,
          atomic: 400
        });
        devWatcher.on('ready', () => {
          devWatcher.on('all', _.debounce(() => {
            console.warn(chalk.yellow.bold('--- >>>>>>>>>>>>>>>>>>>>>>>>>>>> ---'));
            console.warn(chalk.yellow.bold('--- Changes detected: Restarting ---'));
            console.warn(chalk.yellow.bold('--- <<<<<<<<<<<<<<<<<<<<<<<<<<<< ---'));
            this.reload();
          }, 500));
        });
      });
    }
  },
  async reload() {
    // handle that with the following
    // while true; do npm run dev-linux; sleep 3; done
    process.exit()
  }
}

init.dev()
