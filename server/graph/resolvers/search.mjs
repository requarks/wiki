import { generateError, generateSuccess } from '../../helpers/graph.mjs'

export default {
  Mutation: {
    async rebuildSearchIndex (obj, args, context) {
      try {
        await WIKI.data.searchEngine.rebuild()
        return {
          responseResult: generateSuccess('Index rebuilt successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
