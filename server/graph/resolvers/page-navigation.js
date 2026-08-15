const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async pageNavigation () { return {} }
  },
  Mutation: {
    async pageNavigation () { return {} }
  },
  PageNavigationQuery: {
    async providers (obj, args, context, info) {
      let providers = await WIKI.models.pageNavigation.getProviders()
      providers = providers.map(stg => {
        const providerInfo = _.find(WIKI.data.pageNavigationProviders, ['key', stg.key]) || {}
        return {
          ...providerInfo,
          ...stg,
          config: _.sortBy(_.transform(stg.config, (res, value, key) => {
            const configData = _.get(providerInfo.props, key, {})
            res.push({
              key,
              value: JSON.stringify({
                ...configData,
                value
              })
            })
          }, []), 'key')
        }
      })
      return providers
    }
  },
  PageNavigationMutation: {
    async updateProviders (obj, args, context) {
      try {
        for (const str of args.providers) {
          await WIKI.models.pageNavigation.query().patch({
            isEnabled: str.isEnabled,
            config: _.reduce(str.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {})
          }).where('key', str.key)
        }
        await WIKI.models.pageNavigation.initModule()
        return {
          responseResult: graphHelper.generateSuccess('Page navigation providers updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
