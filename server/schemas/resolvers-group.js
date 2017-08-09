'use strict'

/* global wiki */

module.exports = {
  Query: {
    groups(obj, args, context, info) {
      return wiki.db.Group.findAll({ where: args })
    }
  },
  Mutation: {
    createGroup(obj, args) {
      return wiki.db.Group.create(args)
    }
  },
  Group: {
    users(grp) {
      return grp.getUsers()
    }
  }
}
