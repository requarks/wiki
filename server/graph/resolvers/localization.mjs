export default {
  Query: {
    async locales(obj, args, context, info) {
      return WIKI.db.locales.getLocales({ cache: false })
    },
    localeStrings (obj, args, context, info) {
      return WIKI.db.locales.getStrings(args.locale)
    }
  }
}
