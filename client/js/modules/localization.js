import i18next from 'i18next'
import i18nextXHR from 'i18next-xhr-backend'
import i18nextCache from 'i18next-localstorage-cache'
import gql from 'graphql-tag'
import VueI18Next from '@panter/vue-i18next'
import loSet from 'lodash/set'

/* global siteConfig */

module.exports = {
  VueI18Next,
  init() {
    i18next
      .use(i18nextXHR)
      .use(i18nextCache)
      .init({
        backend: {
          loadPath: '{{lng}}/{{ns}}',
          parse: (data) => data,
          ajax: (url, opts, cb, data) => {
            let langParams = url.split('/')
            console.info(langParams)
            window.apollo.query({
              query: gql`
                {
                  translations(locale:"${langParams[0]}", namespace:"${langParams[1]}") {
                    key
                    value
                  }
                }
              `
            }).then(resp => {
              let ns = {}
              if (resp.data.translations.length > 0) {
                resp.data.translations.forEach(entry => {
                  loSet(ns, entry.key, entry.value)
                })
              }
              return cb(ns, {status: '200'})
            }).catch(err => {
              console.error(err)
              return cb(null, {status: '404'})
            })
          }
        },
        cache: {
          enabled: true,
          expiration: 60 * 60 * 1000
        },
        defaultNS: 'common',
        lng: siteConfig.lang,
        fallbackLng: siteConfig.lang,
        ns: ['common', 'admin', 'auth']
      })
    return new VueI18Next(i18next)
  }
}
