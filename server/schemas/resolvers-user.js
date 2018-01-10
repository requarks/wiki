
/* global wiki */

module.exports = {
  Query: {
    users(obj, args, context, info) {
      return wiki.db.User.findAll({ where: args })
    }
  },
  Mutation: {
    createUser(obj, args) {
      return wiki.db.User.create(args)
    },
    deleteUser(obj, args) {
      return wiki.db.User.destroy({
        where: {
          id: args.id
        },
        limit: 1
      })
    },
    login(obj, args, context) {
      return wiki.db.User.login(args, context).catch(err => {
        return {
          succeeded: false,
          message: err.message
        }
      })
    },
    loginTFA(obj, args, context) {
      return wiki.db.User.loginTFA(args, context).catch(err => {
        return {
          succeeded: false,
          message: err.message
        }
      })
    },
    modifyUser(obj, args) {
      return wiki.db.User.update({
        email: args.email,
        name: args.name,
        provider: args.provider,
        providerId: args.providerId,
        role: args.role
      }, {
        where: { id: args.id }
      })
    },
    resetUserPassword(obj, args) {
      return false
    },
    setUserPassword(obj, args) {
      return false
    }
  },
  User: {
    groups(usr) {
      return usr.getGroups()
    }
  }
}
