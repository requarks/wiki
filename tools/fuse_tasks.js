const Promise = require('bluebird')
const colors = require('colors/safe')
const fs = Promise.promisifyAll(require('fs-extra'))
const path = require('path')
const uglify = require('uglify-es')

module.exports = Promise.mapSeries([
  /**
   * SimpleMDE
   */
  () => {
    return fs.accessAsync('./assets/js/simplemde').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('SimpleMDE directory already exists. Task aborted.'))
      return true
    }).catch(err => {
      if (err.code === 'ENOENT') {
        console.info(colors.white('  └── ') + colors.green('Copy + Minify SimpleMDE to assets...'))
        return fs.copy('./node_modules/simplemde/dist/simplemde.min.js', './assets/js/simplemde/simplemde.min.js')
      } else {
        throw err
      }
    })
  },
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
              fs.readFileAsync('./node_modules/brace/ext/modelist.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/theme/dawn.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/theme/tomorrow_night.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/mode/markdown.js', 'utf8')
            ]).then(items => {
              console.info(colors.white('      ace.js'))
              let result = uglify.minify(items.join(';\n'), { output: { 'max_line_len': 1000000 } })
              return fs.writeFileAsync('./assets/js/ace/ace.js', result.code)
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
   * Delete Fusebox cache
   */
  () => {
    console.info(colors.white('  └── ') + colors.green('Clearing fuse-box cache...'))
    return fs.emptyDirAsync('./.fusebox')
  }
], f => { return f() })
