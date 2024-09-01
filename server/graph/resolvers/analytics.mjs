import { find, get, reduce, set, sortBy, transform } from 'lodash-es'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'

export default {
  Query: {
    async analyticsProviders(obj, args, context, info) {
      if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }

      let providers = await WIKI.db.analytics.getProviders(args.isEnabled)
      providers = providers.map(stg => {
        const providerInfo = find(WIKI.data.analytics, ['key', stg.key]) || {}
        return {
          ...providerInfo,
          ...stg,
          config: sortBy(transform(stg.config, (res, value, key) => {
            const configData = get(providerInfo.props, key, {})
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
  Mutation: {
    async updateAnalyticsProviders(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        for (let str of args.providers) {
          await WIKI.db.analytics.query().patch({
            isEnabled: str.isEnabled,
            config: reduce(str.config, (result, value, key) => {
              set(result, `${value.key}`, get(JSON.parse(value.value), 'v', null))
              return result
            }, {})
          }).where('key', str.key)
          await WIKI.cache.del('analytics')
        }
        return {
          responseResult: generateSuccess('Providers updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
