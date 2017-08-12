'use strict'

/**
 * FUSEBOX
 *
 * Client & Server compiler / bundler / watcher
 */

const colors = require('colors/safe')
const fsbx = require('fuse-box')
const nodemon = require('nodemon')
const babel = require('babel-core')
const uglify = require('uglify-es')
const fs = require('fs-extra')

// ======================================================
// Parse cmd arguments
// ======================================================

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

let mode = 'build'
const dev = args.d || args.c
if (args.d) {
  console.info(colors.bgWhite.black(' Starting Fuse in DEVELOPER mode... '))
  mode = 'dev'
} else if (args.c) {
  console.info(colors.bgWhite.black(' Starting Fuse in CONFIGURE DEVELOPER mode... '))
  mode = 'dev-configure'
} else {
  console.info(colors.bgWhite.black(' Starting Fuse in BUILD mode... '))
}

// ======================================================
// BUILD VARS
// ======================================================

const ALIASES = {
  'brace-ext-modelist': 'brace/ext/modelist.js',
  'simplemde': 'simplemde/dist/simplemde.min.js',
  'socket-io-client': 'socket.io-client/dist/socket.io.js',
  'vue': (dev) ? 'vue/dist/vue.js' : 'vue/dist/vue.min.js',
  'vue-lodash': 'vue-lodash/dist/vue-lodash.min.js',
  'vue-resource': (dev) ? 'vue-resource/dist/vue-resource.js' : 'vue-resource/dist/vue-resource.es2015.js'
}
const SHIMS = {
  jquery: {
    source: '../node_modules/jquery/dist/jquery.js',
    exports: '$'
  },
  diff2html: {
    source: '../node_modules/diff2html/dist/diff2html.min.js',
    exports: 'Diff2Html'
  },
  diff2htmlui: {
    source: '../node_modules/diff2html/dist/diff2html-ui.min.js',
    exports: 'Diff2HtmlUI'
  }
}

// ======================================================
// Global Tasks
// ======================================================

console.info(colors.white('└── ') + colors.green('Running global tasks...'))
let globalTasks = require('./fuse_tasks')

// ======================================================
// Fuse Tasks
// ======================================================

globalTasks.then(() => {
  let fuse = fsbx.FuseBox.init({
    homeDir: '../client',
    output: '../assets/js/$name.js',
    alias: ALIASES,
    target: 'browser',
    tsConfig: './tsconfig.json',
    plugins: [
      fsbx.EnvPlugin({ NODE_ENV: (dev) ? 'development' : 'production' }),
      fsbx.VuePlugin(),
      ['.scss', fsbx.SassPlugin({ outputStyle: (dev) ? 'nested' : 'compressed' }), fsbx.CSSPlugin()],
      fsbx.BabelPlugin({ comments: false, presets: ['es2015'] }),
      fsbx.JSONPlugin()
      /* !dev && fsbx.QuantumPlugin({
        target: 'browser',
        uglify: true,
        api: (core) => {
          core.solveComputed('default/js/components/editor-codeblock.vue', {
            mapping: '/js/ace/ace.js',
            fn: (statement, core) => {
              statement.setExpression(`'/js/ace/ace.js'`)
            }
          })
          core.solveComputed('default/js/components/editor.component.js', {
            mapping: '/js/simplemde/simplemde.min.js',
            fn: (statement, core) => {
              statement.setExpression(`'/js/simplemde/simplemde.min.js'`)
            }
          })
        }
      }) */
      // !dev && fsbx.UglifyESPlugin()
    ],
    debug: false,
    log: true
  })

  const bundleVendor = fuse.bundle('vendor').shim(SHIMS).instructions('~ index.js') // eslint-disable-line no-unused-vars
  const bundleApp = fuse.bundle('app').instructions('!> [index.js]')
  // const bundleApp = fuse.bundle('app').shim(SHIMS).instructions('> index.js')
  const bundleSetup = fuse.bundle('configure').instructions('> configure.js')

  switch (mode) {
    case 'dev':
      bundleApp.watch()
      break
    case 'dev-configure':
      bundleSetup.watch()
      break
  }

  fuse.run().then(() => {
    console.info(colors.green.bold('\nAssets compilation + bundling completed.'))

    if (dev) {
      nodemon({
        exec: (args.d) ? 'node server' : 'node wiki configure',
        ignore: ['assets/', 'client/', 'data/', 'repo/', 'tests/'],
        ext: 'js json',
        watch: (args.d) ? ['server'] : ['server/configure.js'],
        env: { 'NODE_ENV': 'development' }
      })
    } else {
      console.info(colors.yellow.bold('\nTranspiling vendor bundle...'))
      let appCode = babel.transform(fs.readFileSync('./assets/js/app.js', 'utf8'), {
        babelrc: false,
        compact: false,
        filename: 'app.js',
        plugins: ['transform-object-assign']
      }).code
      let vendorCode = babel.transform(fs.readFileSync('./assets/js/vendor.js', 'utf8'), {
        babelrc: false,
        comments: false,
        compact: false,
        filename: 'vendor.js',
        plugins: [
          'transform-es2015-arrow-functions',
          'transform-es2015-block-scoped-functions',
          'transform-es2015-block-scoping',
          'transform-es2015-classes',
          'transform-es2015-computed-properties',
          'transform-es2015-destructuring',
          'transform-es2015-duplicate-keys',
          'transform-es2015-for-of',
          'transform-es2015-function-name',
          'transform-es2015-literals',
          'transform-es2015-object-super',
          'transform-es2015-parameters',
          'transform-es2015-shorthand-properties',
          'transform-es2015-spread',
          'transform-es2015-sticky-regex',
          'transform-es2015-template-literals',
          'transform-es2015-typeof-symbol',
          'transform-es2015-unicode-regex'
        ]
      }).code
      console.info(colors.yellow.bold('Minifing bundles...'))
      fs.writeFileSync('./assets/js/vendor.js', uglify.minify(vendorCode).code, 'utf8')
      fs.writeFileSync('./assets/js/app.js', uglify.minify(appCode).code, 'utf8')
      fs.writeFileSync('./assets/js/configure.js', uglify.minify(fs.readFileSync('./assets/js/configure.js', 'utf8')).code, 'utf8')
      console.info(colors.green.bold('\nBUILD SUCCEEDED.'))
      return true
    }
  }).catch(err => {
    console.error(colors.red(' X Bundle compilation failed! ' + err.message))
    process.exit(1)
  })
})
