'use strict'

/* global wiki */

module.exports = {
  Query(obj, args, context, info) {
    return wiki.db.Group.findAll({ where: args })
  },
  Type: {
    users(grp) {
      return grp.getUsers()
    }
  }
}
