import { generateError, generateSuccess } from '../../helpers/graph.mjs'

export default {
  Query: {
    async navigationById (obj, args, context, info) {
      return WIKI.db.navigation.getNav({ id: args.id, cache: true, userGroups: context.req.user?.groups })
    }
  },
  Mutation: {
    async updateNavigation (obj, args, context) {
      try {
        // await WIKI.db.navigation.query().patch({
        //   config: args.tree
        // }).where('key', 'site')
        // for (const tree of args.tree) {
        //   await WIKI.cache.set(`nav:sidebar:${tree.locale}`, tree.items, 300)
        // }

        return {
          responseResult: generateSuccess('Navigation updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
