'use strict'

/**
 * FUSEBOX
 *
 * Client & Server compiler / bundler / watcher
 */

const Promise = require('bluebird')
const autoprefixer = require('autoprefixer')
const colors = require('colors/safe')
const fsbx = require('fuse-box')
const nodemon = require('nodemon')
const fs = require('fs-extra')
const yargs = require('yargs')
const yaml = require('js-yaml')
const path = require('path')

// -------------------------------------------------------
// PARSE CMD ARGUMENTS
// -------------------------------------------------------

const opts = yargs
  .option('d', {
    alias: 'dev',
    describe: 'Start in Developer mode',
    type: 'boolean'
  })
  .option('b', {
    alias: 'build',
    describe: 'Start in Build mode',
    type: 'boolean'
  })
  .help('h')
  .alias('h', 'help')
  .argv

if (opts.dev) {
  console.info(colors.bgWhite.black(' Starting Wiki.js in DEVELOPER mode... '))
} else if (opts.build) {
  console.info(colors.bgWhite.black(' Starting Wiki.js in BUILD mode... '))
} else {
  yargs.showHelp()
  process.exit(0)
}

// -------------------------------------------------------
// GET CONFIG
// -------------------------------------------------------

try {
  const config = yaml.safeLoad(fs.readFileSync(path.join(process.cwd(), 'dev/config/config.yml'), 'utf8'))
  global.config = config
} catch (ex) {
  console.error(ex)
  process.exit(1)
}

// -------------------------------------------------------
// BUILD VARS
// -------------------------------------------------------

const ALIASES = {
  'brace-ext-modelist': 'brace/ext/modelist.js',
  'simplemde': 'simplemde/dist/simplemde.min.js',
  'vue': (opts.dev) ? 'vue/dist/vue.js' : 'vue/dist/vue.min.js',
  'vue-lodash': 'vue-lodash/dist/vue-lodash.min.js',
  'vue-resource': (opts.dev) ? 'vue-resource/dist/vue-resource.js' : 'vue-resource/dist/vue-resource.es2015.js'
}
const SHIMS = {
  diff2html: {
    source: '../../node_modules/diff2html/dist/diff2html.min.js',
    exports: 'Diff2Html'
  },
  diff2htmlui: {
    source: '../../node_modules/diff2html/dist/diff2html-ui.min.js',
    exports: 'Diff2HtmlUI'
  }
}

// -------------------------------------------------------
// Tasks
// -------------------------------------------------------

console.info(colors.white('└── ') + colors.green('Running tasks...'))
let tasks = require('./tasks')
let tasksToRun = []

tasksToRun.push(tasks.cleanFuseboxCache)
tasksToRun.push(tasks.copySimpleMdeAssets)
tasksToRun.push(tasks.copyAceModes)

if (opts.build) {
  tasksToRun.push(tasks.cleanTestResults)
  tasksToRun.push(tasks.fetchLocalizationResources)
}

// -------------------------------------------------------
// FUSEBOX PRODUCER
// -------------------------------------------------------

const babelrc = fs.readJsonSync('.babelrc')
const scssChain = [
  fsbx.SassPlugin({
    includePaths: ['node_modules'],
    outputStyle: opts.dev ? 'nested' : 'compressed'
  }),
  fsbx.PostCSS([
    autoprefixer({
      remove: false,
      browsers: babelrc.presets[0][1].targets.browsers
    })
  ]),
  fsbx.CSSPlugin(opts.dev ? {} : {
    group: 'bundle.css',
    outFile: '../../assets/css/bundle.css',
    inject: false
  })
]

Promise.mapSeries(tasksToRun, fn => fn()).then(() => {
  let fuse = fsbx.FuseBox.init({
    homeDir: '../../client',
    output: '../../assets/js/$name.js',
    alias: ALIASES,
    target: 'browser',
    tsConfig: '../config/tsconfig.json',
    plugins: [
      fsbx.EnvPlugin({ NODE_ENV: (opts.dev) ? 'development' : 'production' }),
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

  if (opts.dev) {
    fuse.dev({
      port: 5555,
      httpServer: false
    })
  }

  // -------------------------------------------------------
  // FUSEBOX BUNDLES
  // -------------------------------------------------------

  if (opts.dev) {
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
    return true
  }).catch(err => {
    console.error(colors.red(' X Bundle compilation failed! ' + err.message))
    process.exit(1)
  })
})
