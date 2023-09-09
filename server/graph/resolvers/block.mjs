import { generateError, generateSuccess } from '../../helpers/graph.mjs'

export default {
  Query: {
    async blocks (obj, args, context) {
      return WIKI.db.blocks.query().where({
        siteId: args.siteId
      })
    }
  },
  Mutation: {
    async setBlocksState(obj, args, context) {
      try {
        // TODO: update blocks state
        return {
          operation: generateSuccess('Blocks state updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
