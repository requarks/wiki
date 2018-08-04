const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async storage() { return {} }
  },
  Mutation: {
    async storage() { return {} }
  },
  StorageQuery: {
    async targets(obj, args, context, info) {
      let targets = await WIKI.models.storage.getTargets()
      targets = targets.map(tgt => {
        const targetInfo = _.find(WIKI.data.storage, ['key', tgt.key]) || {}
        return {
          ...targetInfo,
          ...tgt,
          config: _.sortBy(_.transform(tgt.config, (res, value, key) => {
            const configData = _.get(targetInfo.props, key, {})
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
      if (args.filter) { targets = graphHelper.filter(targets, args.filter) }
      if (args.orderBy) { targets = graphHelper.orderBy(targets, args.orderBy) }
      return targets
    }
  },
  StorageMutation: {
    async updateTargets(obj, args, context) {
      try {
        for (let tgt of args.targets) {
          await WIKI.models.storage.query().patch({
            isEnabled: tgt.isEnabled,
            mode: tgt.mode,
            config: _.reduce(tgt.config, (result, value, key) => {
              _.set(result, `${value.key}`, value.value)
              return result
            }, {})
          }).where('key', tgt.key)
        }
        return {
          responseResult: graphHelper.generateSuccess('Storage targets updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
