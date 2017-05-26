'use strict'

/**
 * FUSEBOX
 *
 * Client & Server compiler / bundler / watcher
 */

const _ = require('lodash')
const Promise = require('bluebird')
const colors = require('colors/safe')
const fs = Promise.promisifyAll(require('fs-extra'))
const fsbx = require('fuse-box')
const nodemon = require('nodemon')
const path = require('path')
const uglify = require('uglify-es')

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
  'vue-lodash': 'vue-lodash/dist/vue-lodash.min.js'
}
const SHIMS = {
  _preinit: {
    source: '.build/_preinit.js',
    exports: '_preinit'
  },
  jquery: {
    source: 'node_modules/jquery/dist/jquery.js',
    exports: '$'
  },
  mathjax: {
    source: 'node_modules/mathjax/MathJax.js',
    exports: 'MathJax'
  }
}

// ======================================================
// Global Tasks
// ======================================================

console.info(colors.white('└── ') + colors.green('Running global tasks...'))

let globalTasks = Promise.mapSeries([
  /**
   * ACE Modes
   */
  () => {
    return fs.accessAsync('./assets/js/ace').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('ACE modes directory already exists. Task aborted.'))
      return true
    }).catch(err => {
      if (err.code === 'ENOENT') {
        console.info(colors.white('  └── ') + colors.green('Copy + Minify ACE modes to assets...'))
        return fs.ensureDirAsync('./assets/js/ace').then(() => {
          return Promise.join(
            // Core
            Promise.all([
              fs.readFileAsync('./node_modules/brace/index.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/theme/dawn.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/mode/markdown.js', 'utf8')
            ]).then(items => {
              console.info(colors.white('      source-view.js'))
              let result = uglify.minify(items.join(';\n'), { output: { 'max_line_len': 1000000 } })
              return fs.writeFileAsync('./assets/js/ace/source-view.js', result.code)
            }),
            // Modes
            fs.readdirAsync('./node_modules/brace/mode').then(modeList => {
              return Promise.map(modeList, mdFile => {
                return fs.readFileAsync(path.join('./node_modules/brace/mode', mdFile), 'utf8').then(modeCode => {
                  console.info(colors.white('      mode-' + mdFile))
                  let result = uglify.minify(modeCode, { output: { 'max_line_len': 1000000 } })
                  return fs.writeFileAsync(path.join('./assets/js/ace', 'mode-' + mdFile), result.code)
                })
              }, { concurrency: 3 })
            })
          )
        })
      } else {
        throw err
      }
    })
  },
  /**
   * MathJax
   */
  () => {
    return fs.accessAsync('./assets/js/mathjax').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('MathJax directory already exists. Task aborted.'))
      return true
    }).catch(err => {
      if (err.code === 'ENOENT') {
        console.info(colors.white('  └── ') + colors.green('Copy MathJax dependencies to assets...'))
        return fs.ensureDirAsync('./assets/js/mathjax').then(() => {
          return fs.copyAsync('./node_modules/mathjax', './assets/js/mathjax', {
            filter: (src, dest) => {
              let srcNormalized = src.replace(/\\/g, '/')
              let shouldCopy = false
              console.info(colors.white('      ' + srcNormalized))
              _.forEach([
                '/node_modules/mathjax',
                '/node_modules/mathjax/jax',
                '/node_modules/mathjax/jax/input',
                '/node_modules/mathjax/jax/output'
              ], chk => {
                if (srcNormalized.endsWith(chk)) {
                  shouldCopy = true
                }
              })
              _.forEach([
                '/node_modules/mathjax/extensions',
                '/node_modules/mathjax/MathJax.js',
                '/node_modules/mathjax/jax/element',
                '/node_modules/mathjax/jax/input/MathML',
                '/node_modules/mathjax/jax/input/TeX',
                '/node_modules/mathjax/jax/output/SVG'
              ], chk => {
                if (srcNormalized.indexOf(chk) > 0) {
                  shouldCopy = true
                }
              })
              if (shouldCopy && srcNormalized.indexOf('/fonts/') > 0 && srcNormalized.indexOf('/STIX-Web') <= 1) {
                shouldCopy = false
              }
              return shouldCopy
            }
          })
        })
      } else {
        throw err
      }
    })
  },
  /**
   * i18n
   */
  () => {
    console.info(colors.white('  └── ') + colors.green('Copying i18n client files...'))
    return fs.ensureDirAsync('./assets/js/i18n').then(() => {
      return fs.readJsonAsync('./server/locales/en/browser.json').then(enContent => {
        return fs.readdirAsync('./server/locales').then(langs => {
          return Promise.map(langs, lang => {
            console.info(colors.white('      ' + lang + '.json'))
            let outputPath = path.join('./assets/js/i18n', lang + '.json')
            return fs.readJsonAsync(path.join('./server/locales', lang + '.json'), 'utf8').then((content) => {
              return fs.outputJsonAsync(outputPath, _.defaultsDeep(content, enContent))
            }).catch(err => { // eslint-disable-line handle-callback-err
              return fs.outputJsonAsync(outputPath, enContent)
            })
          })
        })
      })
    })
  },
  /**
   * Bundle pre-init scripts
   */
  () => {
    console.info(colors.white('  └── ') + colors.green('Bundling pre-init scripts...'))
    let preInitContent = ''
    return fs.readdirAsync('./client/js/pre-init').map(f => {
      let fPath = path.join('./client/js/pre-init/', f)
      return fs.readFileAsync(fPath, 'utf8').then(fContent => {
        preInitContent += fContent + ';\n'
      })
    }).then(() => {
      return fs.outputFileAsync('./.build/_preinit.js', preInitContent, 'utf8')
    })
  },
  /**
   * Delete Fusebox cache
   */
  () => {
    console.info(colors.white('  └── ') + colors.green('Clearing fuse-box cache...'))
    return fs.emptyDirAsync('./.fusebox')
  }
], f => { return f() })

// ======================================================
// Fuse Tasks
// ======================================================

globalTasks.then(() => {
  let fuse = fsbx.FuseBox.init({
    homeDir: './client',
    output: './assets/js/$name.min.js',
    alias: ALIASES,
    shim: SHIMS,
    plugins: [
      fsbx.EnvPlugin({ NODE_ENV: (dev) ? 'development' : 'production' }),
      fsbx.VuePlugin(),
      ['.scss', fsbx.SassPlugin({ outputStyle: (dev) ? 'nested' : 'compressed' }), fsbx.CSSPlugin()],
      dev && fsbx.BabelPlugin({ comments: false, presets: ['es2015'] }),
      fsbx.JSONPlugin(),
      !dev && fsbx.UglifyESPlugin({
        compress: { unused: false },
        output: { 'max_line_len': 1000000 }
      })
    ],
    debug: false,
    log: true
  })

  if (dev) {
    fuse.dev({
      port: 4444,
      httpServer: false
    })
  }

  // const bundleLibs = fuse.bundle('libs').instructions('~ index.js - brace')
  // const bundleApp = fuse.bundle('app').instructions('!> [index.js]')
  const bundleApp = fuse.bundle('app').instructions('> index.js')
  const bundleSetup = fuse.bundle('configure').instructions('> configure.js')

  switch (mode) {
    case 'dev':
      // bundleLibs.watch()
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
    }
  }).catch(err => {
    console.error(colors.red(' X Bundle compilation failed! ' + err.message))
    process.exit(1)
  })
})
