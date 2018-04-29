const _ = require('lodash')
const dotize = require('dotize')
const i18nMW = require('i18next-express-middleware')
const i18next = require('i18next')
const Promise = require('bluebird')

/* global WIKI */

module.exports = {
  engine: null,
  namespaces: [],
  init() {
    this.namespaces = WIKI.data.localeNamespaces
    this.engine = i18next
    this.engine.init({
      load: 'languageOnly',
      ns: this.namespaces,
      defaultNS: 'common',
      saveMissing: false,
      preload: [WIKI.config.site.lang],
      lng: WIKI.config.site.lang,
      fallbackLng: 'en'
    })
    return this
  },
  attachMiddleware (app) {
    app.use(i18nMW.handle(this.engine))
  },
  async getByNamespace(locale, namespace) {
    if (this.engine.hasResourceBundle(locale, namespace)) {
      let data = this.engine.getResourceBundle(locale, namespace)
      return _.map(dotize.convert(data), (value, key) => {
        return {
          key,
          value
        }
      })
    } else {
      throw new Error('Invalid locale or namespace')
    }
  },
  async loadLocale(locale) {
    return Promise.fromCallback(cb => {
      return this.engine.loadLanguages(locale, cb)
    })
  },
  async setCurrentLocale(locale) {
    return Promise.fromCallback(cb => {
      return this.engine.changeLanguage(locale, cb)
    })
  }
}
