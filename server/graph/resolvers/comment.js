const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async comments() { return {} }
  },
  Mutation: {
    async comments() { return {} }
  },
  CommentQuery: {
    async providers(obj, args, context, info) {
      const providers = await WIKI.models.commentProviders.getProviders()
      return providers.map(provider => {
        const providerInfo = _.find(WIKI.data.commentProviders, ['key', provider.key]) || {}
        return {
          ...providerInfo,
          ...provider,
          config: _.sortBy(_.transform(provider.config, (res, value, key) => {
            const configData = _.get(providerInfo.props, key, false)
            if (configData) {
              res.push({
                key,
                value: JSON.stringify({
                  ...configData,
                  value
                })
              })
            }
          }, []), 'key')
        }
      })
    },
    async list (obj, args, context) {
      return []
    }
  },
  CommentMutation: {
    async updateProviders(obj, args, context) {
      try {
        for (let provider of args.providers) {
          await WIKI.models.commentProviders.query().patch({
            isEnabled: provider.isEnabled,
            config: _.reduce(provider.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {})
          }).where('key', provider.key)
        }
        await WIKI.models.commentProviders.initProvider()
        return {
          responseResult: graphHelper.generateSuccess('Comment Providers updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
