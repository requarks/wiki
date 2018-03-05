
/* global WIKI */

module.exports = {
  Query: {
    translations (obj, args, context, info) {
      return WIKI.lang.getByNamespace(args.locale, args.namespace)
    }
  },
  Mutation: {},
  Translation: {}
}
