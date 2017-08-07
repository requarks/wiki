'use strict'

/* global wiki */

module.exports = {
  Query(obj, args, context, info) {
    return wiki.db.User.findAll({ where: args })
  },
  Type: {
    groups(usr) {
      return usr.getGroups()
    }
  }
}
