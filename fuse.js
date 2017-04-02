'use strict'

/**
 * FUSEBOX
 *
 * Client & Server compiler / watcher
 */

const fsbx = require('fuse-box')
const colors = require('colors/safe')
const _ = require('lodash')

// Parse cmd arguments

const args = require('yargs')
    .option('d', {
      alias: 'dev',
      describe: 'Start in Developer mode',
      type: 'boolean'
    })
    .option('c', {
      alias: 'dev-configure',
      describe: 'Start in Configure Developer mode',
      type: 'boolean'
    })
    .help('h')
    .alias('h', 'help')
    .argv

// Define aliases

const ALIASES = {
  'brace-ext-modelist': 'brace/ext/modelist.js',
  'simplemde': 'simplemde/dist/simplemde.min.js',
  'socket.io-client': 'socket.io-client/dist/socket.io.min.js',
  'vue': 'vue/dist/vue.js'
}
const SHIMS = {
  jquery: {
    source: 'node_modules/jquery/dist/jquery.js',
    exports: '$'
  }
}

if (args.d) {
  // =============================================
  // DEVELOPER MODE
  // =============================================

  console.info(colors.bgWhite.black(' Starting Fuse in DEVELOPER mode... '))

  const nodemon = require('nodemon')

  // Client

  const fuse = fsbx.FuseBox.init({
    homeDir: './client',
    outFile: './assets/js/bundle.min.js',
    alias: ALIASES,
    shim: SHIMS,
    plugins: [
      [ fsbx.SassPlugin({ includePaths: ['../core'] }), fsbx.CSSPlugin() ],
      fsbx.BabelPlugin({ comments: false, presets: ['es2015'] }),
      fsbx.JSONPlugin()
    ],
    debug: false,
    log: true
  })

  fuse.devServer('>index.js', {
    port: 4444,
    httpServer: false,
    hmr: false
  })

  // Server

  _.delay(() => {
    nodemon({
      script: './server.js',
      args: [],
      ignore: ['assets/', 'client/', 'data/', 'repo/', 'tests/'],
      ext: 'js json',
      watch: [
        'controllers',
        'libs',
        'locales',
        'middlewares',
        'models',
        'agent.js',
        'server.js'
      ],
      env: { 'NODE_ENV': 'development' }
    })
  }, 1000)
} else if (args.c) {
  // =============================================
  // CONFIGURE - DEVELOPER MODE
  // =============================================

  console.info(colors.bgWhite.black(' Starting Fuse in CONFIGURE DEVELOPER mode... '))

  const nodemon = require('nodemon')

  // Client

  const fuse = fsbx.FuseBox.init({
    homeDir: './client',
    outFile: './assets/js/configure.min.js',
    alias: ALIASES,
    shim: SHIMS,
    plugins: [
      [ fsbx.SassPlugin({ includePaths: ['../core'] }), fsbx.CSSPlugin() ],
      fsbx.BabelPlugin({ comments: false, presets: ['es2015'] }),
      fsbx.JSONPlugin()
    ],
    debug: false,
    log: true
  })

  fuse.devServer('>configure.js', {
    port: 4444,
    httpServer: false
  })

  // Server

  _.delay(() => {
    nodemon({
      exec: 'node wiki configure',
      ignore: ['assets/', 'client/', 'data/', 'repo/', 'tests/'],
      ext: 'js json',
      watch: [
        'configure.js'
      ],
      env: { 'NODE_ENV': 'development' }
    })
  }, 1000)
} else {
  // =============================================
  // BUILD MODE
  // =============================================

  console.info(colors.bgWhite.black(' Starting Fuse in BUILD mode... '))

  const fuse = fsbx.FuseBox.init({
    homeDir: './client',
    alias: ALIASES,
    shim: SHIMS,
    plugins: [
      [ fsbx.SassPlugin({ outputStyle: 'compressed', includePaths: ['./node_modules/requarks-core'] }), fsbx.CSSPlugin() ],
      fsbx.BabelPlugin({
        config: {
          comments: false,
          presets: ['es2015']
        }
      }),
      fsbx.JSONPlugin(),
      fsbx.UglifyJSPlugin({
        compress: { unused: false }
      })
    ],
    debug: false,
    log: true
  })

  fuse.bundle({
    './assets/js/bundle.min.js': '>index.js',
    './assets/js/configure.min.js': '>configure.js'
  }).then(() => {
    console.info(colors.green.bold('Assets compilation + bundling completed.'))
  }).catch(err => {
    console.error(colors.green.red(' X Bundle compilation failed! ' + err.message))
    process.exit(1)
  })
}
