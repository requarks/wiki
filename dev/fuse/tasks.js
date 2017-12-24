/* global config */

const Promise = require('bluebird')
const colors = require('colors/safe')
const fs = Promise.promisifyAll(require('fs-extra'))
const path = require('path')
const uglify = require('uglify-es')
const request = require('request-promise')
const yaml = require('js-yaml')
const _ = require('lodash')

module.exports = {
  /**
   * Fetch Localization Resources from Lokalise
   */
  async fetchLocalizationResources () {
    console.info(colors.white('  └── ') + colors.green('Fetching latest localization resources...'))
    let langs = await request({
      method: 'POST',
      uri: `${config.lokalise.api}/string/list`,
      form: {
        api_token: config.lokalise.key,
        id: config.lokalise.project
      },
      json: true
    })
    if (langs && langs.strings && _.isPlainObject(langs.strings)) {
      _.forIn(langs.strings, (langData, langKey) => {
        let lang = {}
        let langTotal = 0
        langData.forEach(item => {
          if (item.is_archived === '1' || _.includes(item.key, '::')) { return }
          let keyParts = item.key.split(':')
          let keyNamespace = (keyParts.length > 1) ? _.head(keyParts) : 'common'
          let keyString = _.last(keyParts)
          _.set(lang, `${keyNamespace}.${keyString}`, item.translation)
          langTotal++
        })
        _.forOwn(lang, (langObject, langNamespace) => {
          let langYaml = yaml.safeDump(langObject, {
            indent: 2,
            sortKeys: true,
            lineWidth: 2048
          })
          fs.outputFileSync(path.join(process.cwd(), `server/locales/${langKey}/${langNamespace}.yml`), langYaml, 'utf8')
        })
        console.info(colors.white(`      ${langKey} - ${langTotal} keys written`))
      })
    } else {
      throw new Error('Failed to fetch language list from Lokalise API.')
    }
    return true
  },
  /**
   * SimpleMDE
   */
  copySimpleMdeAssets () {
    return fs.accessAsync('./assets/js/simplemde').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('SimpleMDE directory already exists. Task skipped.'))
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
  copyAceModes () {
    return fs.accessAsync('./assets/js/ace').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('ACE modes directory already exists. Task skipped.'))
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
  cleanFuseboxCache () {
    console.info(colors.white('  └── ') + colors.green('Clearing fuse-box cache...'))
    return fs.emptyDirAsync('./.fusebox')
  },
  /**
   * Delete Test Results
   */
  cleanTestResults () {
    console.info(colors.white('  └── ') + colors.green('Clearing test results...'))
    return fs.remove('./test-results')
  }
}
