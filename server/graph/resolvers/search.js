const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Mutation: {
    async rebuildSearchIndex (obj, args, context) {
      try {
        await WIKI.data.searchEngine.rebuild()
        return {
          responseResult: graphHelper.generateSuccess('Index rebuilt successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
