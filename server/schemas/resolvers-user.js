'use strict'

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
    }
  },
  User: {
    groups(usr) {
      return usr.getGroups()
    }
  }
}
