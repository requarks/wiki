const Promise = require('bluebird')
const colors = require('colors/safe')
const fs = Promise.promisifyAll(require('fs-extra'))
const path = require('path')
const request = require('request-promise')
const yaml = require('js-yaml')
const _ = require('lodash')

const config = yaml.safeLoad(fs.readFileSync(path.join(process.cwd(), 'dev/config/config.yml'), 'utf8'))

/**
 * Fetch Localization Resources from Lokalise
 */
const fetchLocalizationResources = async () => {
  console.info(colors.green('Fetching latest localization resources...'))
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
      console.info(colors.grey(`└─ ${langKey} - ${langTotal} keys written`))
    })
  } else {
    throw new Error('Failed to fetch language list from Lokalise API.')
  }
}

try {
  fetchLocalizationResources()
} catch (err) {
  console.error(colors.red(err))
}
