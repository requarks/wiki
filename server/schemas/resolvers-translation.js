
/* global wiki */

module.exports = {
  Query: {
    translations (obj, args, context, info) {
      return wiki.lang.getByNamespace(args.locale, args.namespace)
    }
  },
  Mutation: {},
  Translation: {}
}
