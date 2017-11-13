'use strict'

/**
 * FUSEBOX
 *
 * Client & Server compiler / bundler / watcher
 */

const autoprefixer = require('autoprefixer')
const colors = require('colors/safe')
const fsbx = require('fuse-box')
const nodemon = require('nodemon')
const fs = require('fs-extra')

// -------------------------------------------------------
// Parse cmd arguments
// -------------------------------------------------------

const args = require('yargs')
  .option('d', {
    alias: 'dev',
    describe: 'Start in Developer mode',
    type: 'boolean'
  })
  .help('h')
  .alias('h', 'help')
  .argv

const dev = args.dev

if (dev) {
  console.info(colors.bgWhite.black(' Starting Fuse in DEVELOPER mode... '))
} else {
  console.info(colors.bgWhite.black(' Starting Fuse in BUILD mode... '))
}

// -------------------------------------------------------
// BUILD VARS
// -------------------------------------------------------

const ALIASES = {
  'brace-ext-modelist': 'brace/ext/modelist.js',
  'simplemde': 'simplemde/dist/simplemde.min.js',
  'vue': (dev) ? 'vue/dist/vue.js' : 'vue/dist/vue.min.js',
  'vue-lodash': 'vue-lodash/dist/vue-lodash.min.js',
  'vue-resource': (dev) ? 'vue-resource/dist/vue-resource.js' : 'vue-resource/dist/vue-resource.es2015.js'
}
const SHIMS = {
  diff2html: {
    source: '../node_modules/diff2html/dist/diff2html.min.js',
    exports: 'Diff2Html'
  },
  diff2htmlui: {
    source: '../node_modules/diff2html/dist/diff2html-ui.min.js',
    exports: 'Diff2HtmlUI'
  }
}

// -------------------------------------------------------
// Global Tasks
// -------------------------------------------------------

console.info(colors.white('└── ') + colors.green('Running global tasks...'))
let globalTasks = require('./fuse_tasks')

// -------------------------------------------------------
// FUSEBOX PRODUCER
// -------------------------------------------------------

const babelrc = fs.readJsonSync('.babelrc')
const scssChain = [
  fsbx.SassPlugin({
    includePaths: ['node_modules'],
    outputStyle: dev ? 'nested' : 'compressed'
  }),
  fsbx.PostCSS([
    autoprefixer({
      remove: false,
      browsers: babelrc.presets[0][1].targets.browsers
    })
  ]),
  fsbx.CSSPlugin(dev ? {} : {
    group: 'bundle.css',
    outFile: './assets/css/bundle.css',
    inject: false
  })
]

globalTasks.then(() => {
  let fuse = fsbx.FuseBox.init({
    homeDir: '../client',
    output: '../assets/js/$name.js',
    alias: ALIASES,
    target: 'browser',
    tsConfig: './tsconfig.json',
    plugins: [
      fsbx.EnvPlugin({ NODE_ENV: (dev) ? 'development' : 'production' }),
      fsbx.VueComponentPlugin({
        script: fsbx.BabelPlugin(babelrc),
        template: fsbx.ConsolidatePlugin({
          engine: 'pug'
        }),
        style: scssChain
      }),
      scssChain,
      fsbx.RawPlugin(['.svg']),
      fsbx.BabelPlugin(babelrc),
      fsbx.JSONPlugin()
    ],
    debug: false,
    log: true
  })

  // -------------------------------------------------------
  // FUSEBOX DEV
  // -------------------------------------------------------

  if (dev) {
    fuse.dev({
      port: 5555,
      httpServer: false
    })
  }

  // -------------------------------------------------------
  // FUSEBOX BUNDLES
  // -------------------------------------------------------

  if (dev) {
    fuse.bundle('libs').shim(SHIMS).instructions('~ index.js')
    fuse.bundle('app').instructions('!> [index.js]').hmr({ reload: true }).watch()
  } else {
    fuse.bundle('bundle.min.js').shim(SHIMS).instructions('> index.js')
  }

  // -------------------------------------------------------
  // FUSEBOX RUN
  // -------------------------------------------------------

  fuse.run().then(() => {
    console.info(colors.green.bold('\nAssets compilation + bundling completed.'))

    if (dev) {
      nodemon({
        exec: 'node server',
        ignore: ['assets/', 'client/', 'data/', 'repo/', 'tests/', 'tools/'],
        ext: 'js json graphql',
        watch: ['server'],
        env: { 'NODE_ENV': 'development' }
      })
    }
    return true
  }).catch(err => {
    console.error(colors.red(' X Bundle compilation failed! ' + err.message))
    process.exit(1)
  })
})
