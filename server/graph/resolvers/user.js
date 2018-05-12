
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
      return WIKI.db.User.findAll({
        attributes: {
          exclude: ['password', 'tfaSecret']
        },
        raw: true
      })
    },
    async search(obj, args, context, info) {
      return WIKI.db.User.findAll({
        where: {
          $or: [
            { email: { $like: `%${args.query}%` } },
            { name: { $like: `%${args.query}%` } }
          ]
        },
        limit: 10,
        attributes: ['id', 'email', 'name', 'provider', 'role', 'createdAt', 'updatedAt'],
        raw: true
      })
    },
    async single(obj, args, context, info) {
      return WIKI.db.User.findById(args.id)
    }
  },
  UserMutation: {
    create(obj, args) {
      return WIKI.db.User.create(args)
    },
    delete(obj, args) {
      return WIKI.db.User.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    update(obj, args) {
      return WIKI.db.User.update({
        email: args.email,
        name: args.name,
        provider: args.provider,
        providerId: args.providerId,
        role: args.role
      }, {
        where: { id: args.id }
      })
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
