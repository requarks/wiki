const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async analytics() { return {} }
  },
  Mutation: {
    async analytics() { return {} }
  },
  AnalyticsQuery: {
    async providers(obj, args, context, info) {
      let providers = await WIKI.models.analytics.getProviders(args.isEnabled)
      providers = providers.map(stg => {
        const providerInfo = _.find(WIKI.data.analytics, ['key', stg.key]) || {}
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
  AnalyticsMutation: {
    async updateProviders(obj, args, context) {
      try {
        for (let str of args.providers) {
          await WIKI.models.analytics.query().patch({
            isEnabled: str.isEnabled,
            config: _.reduce(str.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {})
          }).where('key', str.key)
          await WIKI.cache.del('analytics')
        }
        return {
          responseResult: graphHelper.generateSuccess('Providers updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
