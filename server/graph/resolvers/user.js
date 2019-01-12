
/* global WIKI */

module.exports = {
  Query: {
    async users() { return {} }
  },
  Mutation: {
    async users() { return {} }
  },
  UserQuery: {
    async list(obj, args, context, info) {
      return WIKI.models.users.query()
        .select('id', 'email', 'name', 'providerKey', 'isSystem', 'createdAt')
    },
    async search(obj, args, context, info) {
      return WIKI.models.users.query()
        .where('email', 'like', `%${args.query}%`)
        .orWhere('name', 'like', `%${args.query}%`)
        .limit(10)
        .select('id', 'email', 'name', 'providerKey', 'createdAt')
    },
    async single(obj, args, context, info) {
      let usr = await WIKI.models.users.query().findById(args.id)
      usr.password = ''
      usr.tfaSecret = ''
      return usr
    }
  },
  UserMutation: {
    create(obj, args) {
      return WIKI.models.users.register({
        ...args,
        verify: false,
        bypassChecks: true
      })
    },
    delete(obj, args) {
      return WIKI.models.users.query().deleteById(args.id)
    },
    update(obj, args) {
      return WIKI.models.users.query().patch({
        email: args.email,
        name: args.name,
        provider: args.provider,
        providerId: args.providerId
      }).where('id', args.id)
    },
    resetPassword(obj, args) {
      return false
    },
    setPassword(obj, args) {
      return false
    }
  },
  User: {
    groups(usr) {
      return usr.$relatedQuery('groups')
    }
  }
}
