const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async navigation() { return {} }
  },
  Mutation: {
    async navigation() { return {} }
  },
  NavigationQuery: {
    async tree(obj, args, context, info) {
      // let renderers = await WIKI.models.renderers.getRenderers()
      return []
    }
  },
  NavigationMutation: {
    async updateTree(obj, args, context) {
      try {
        // for (let rdr of args.renderers) {
        //   await WIKI.models.storage.query().patch({
        //     isEnabled: rdr.isEnabled,
        //     config: _.reduce(rdr.config, (result, value, key) => {
        //       _.set(result, `${value.key}`, value.value)
        //       return result
        //     }, {})
        //   }).where('key', rdr.key)
        // }
        return {
          responseResult: graphHelper.generateSuccess('Navigation updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
