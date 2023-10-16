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
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:blocks'])) {
          throw new Error('ERR_FORBIDDEN')
        }
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
