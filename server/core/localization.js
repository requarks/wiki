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
      lng: WIKI.config.site.lang,
      fallbackLng: 'en'
    })

    // Load fallback defaults
    const enFallback = require('../locales/default.json')
    if (_.isPlainObject(enFallback)) {
      _.forOwn(enFallback, (data, ns) => {
        this.namespaces.push(ns)
        this.engine.addResourceBundle('en', ns, data)
      })
    }

    // Load current language
    this.loadLocale(WIKI.config.site.lang, { silent: true })

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
  async loadLocale(locale, opts = { silent: false }) {
    const res = await WIKI.db.locales.query().findOne('code', locale)
    if (res) {
      if (_.isPlainObject(res.strings)) {
        _.forOwn(res.strings, (data, ns) => {
          this.namespaces.push(ns)
          this.engine.addResourceBundle(locale, ns, data, true, true)
        })
      }
    } else if (!opts.silent) {
      throw new Error('No such locale in local store.')
    }
  },
  async setCurrentLocale(locale) {
    return Promise.fromCallback(cb => {
      return this.engine.changeLanguage(locale, cb)
    })
  }
}
