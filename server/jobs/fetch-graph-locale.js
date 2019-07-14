const _ = require('lodash')
const { createApolloFetch } = require('apollo-fetch')

/* global WIKI */

module.exports = async (localeCode) => {
  WIKI.logger.info(`Fetching locale ${localeCode} from Graph endpoint...`)

  try {
    const apollo = createApolloFetch({
      uri: WIKI.config.graphEndpoint
    })

    const respStrings = await apollo({
      query: `query ($code: String!) {
        localization {
          strings(code: $code) {
            key
            value
          }
        }
      }`,
      variables: {
        code: localeCode
      }
    })
    const strings = _.get(respStrings, 'data.localization.strings', [])
    let lcObj = {}
    _.forEach(strings, row => {
      if (_.includes(row.key, '::')) { return }
      if (_.isEmpty(row.value)) {
        row.value = row.key
      }
      _.set(lcObj, row.key.replace(':', '.'), row.value)
    })

    const locales = await WIKI.cache.get('locales')
    if (locales) {
      const currentLocale = _.find(locales, ['code', localeCode]) || {}
      const existingLocale = await WIKI.models.locales.query().where('code', localeCode).first()
      if (existingLocale) {
        await WIKI.models.locales.query().patch({
          strings: lcObj
        }).where('code', localeCode)
      } else {
        await WIKI.models.locales.query().insert({
          code: localeCode,
          strings: lcObj,
          isRTL: currentLocale.isRTL,
          name: currentLocale.name,
          nativeName: currentLocale.nativeName,
          availability: currentLocale.availability
        })
      }
    } else {
      throw new Error('Failed to fetch cached locales list! Restart server to resolve this issue.')
    }

    await WIKI.lang.refreshNamespaces()

    WIKI.logger.info(`Fetching locale ${localeCode} from Graph endpoint: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Fetching locale ${localeCode} from Graph endpoint: [ FAILED ]`)
    WIKI.logger.error(err.message)
  }
}
