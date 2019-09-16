const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async rendering() { return {} }
  },
  Mutation: {
    async rendering() { return {} }
  },
  RenderingQuery: {
    async renderers(obj, args, context, info) {
      let renderers = await WIKI.models.renderers.getRenderers()
      renderers = renderers.map(rdr => {
        const rendererInfo = _.find(WIKI.data.renderers, ['key', rdr.key]) || {}
        return {
          ...rendererInfo,
          ...rdr,
          config: _.sortBy(_.transform(rdr.config, (res, value, key) => {
            const configData = _.get(rendererInfo.props, key, {})
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
      // if (args.filter) { renderers = graphHelper.filter(renderers, args.filter) }
      if (args.orderBy) { renderers = _.sortBy(renderers, [args.orderBy]) }
      return renderers
    }
  },
  RenderingMutation: {
    async updateRenderers(obj, args, context) {
      try {
        for (let rdr of args.renderers) {
          await WIKI.models.storage.query().patch({
            isEnabled: rdr.isEnabled,
            config: _.reduce(rdr.config, (result, value, key) => {
              _.set(result, `${value.key}`, value.value)
              return result
            }, {})
          }).where('key', rdr.key)
        }
        return {
          responseResult: graphHelper.generateSuccess('Renderers updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
