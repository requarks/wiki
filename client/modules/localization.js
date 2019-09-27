import i18next from 'i18next'
import Backend from 'i18next-chained-backend'
import LocalStorageBackend from 'i18next-localstorage-backend'
import i18nextXHR from 'i18next-xhr-backend'
import VueI18Next from '@panter/vue-i18next'
import _ from 'lodash'

/* global siteConfig, graphQL */

import localeQuery from 'gql/common/common-localization-query-translations.gql'

export default {
  VueI18Next,
  init() {
    i18next
      .use(Backend)
      .init({
        backend: {
          backends: [
            LocalStorageBackend,
            i18nextXHR
          ],
          backendOptions: [
            {
              expirationTime: 1000 * 60 * 60 * 24 // 24h
            },
            {
              loadPath: '{{lng}}/{{ns}}',
              parse: (data) => data,
              ajax: (url, opts, cb, data) => {
                let langParams = url.split('/')
                graphQL.query({
                  query: localeQuery,
                  variables: {
                    locale: langParams[0],
                    namespace: langParams[1]
                  }
                }).then(resp => {
                  let ns = {}
                  if (_.get(resp, 'data.localization.translations', []).length > 0) {
                    resp.data.localization.translations.forEach(entry => {
                      _.set(ns, entry.key, entry.value)
                    })
                  }
                  return cb(ns, {status: '200'})
                }).catch(err => {
                  console.error(err)
                  return cb(null, {status: '404'})
                })
              }
            }
          ]
        },
        defaultNS: 'common',
        lng: siteConfig.lang,
        load: 'currentOnly',
        lowerCaseLng: true,
        fallbackLng: siteConfig.lang,
        ns: ['common', 'auth']
      })
    return new VueI18Next(i18next)
  }
}
