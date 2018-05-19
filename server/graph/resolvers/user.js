
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
      return WIKI.db.users.query()
        .select('id', 'email', 'name', 'provider', 'role', 'createdAt', 'updatedAt')
    },
    async search(obj, args, context, info) {
      return WIKI.db.users.query()
        .where('email', 'like', `%${args.query}%`)
        .orWhere('name', 'like', `%${args.query}%`)
        .limit(10)
        .select('id', 'email', 'name', 'provider', 'role', 'createdAt', 'updatedAt')
    },
    async single(obj, args, context, info) {
      return WIKI.db.users.query().findById(args.id)
    }
  },
  UserMutation: {
    create(obj, args) {
      return WIKI.db.users.query().insertAndFetch(args)
    },
    delete(obj, args) {
      return WIKI.db.users.query().deleteById(args.id)
    },
    update(obj, args) {
      return WIKI.db.users.query().patch({
        email: args.email,
        name: args.name,
        provider: args.provider,
        providerId: args.providerId,
        role: args.role
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
      return usr.getGroups()
    }
  }
}
