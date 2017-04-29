'use strict'

/* global db */

const _ = require('lodash')

/**
 * Rights
 */
module.exports = {

  guest: {
    provider: 'local',
    email: 'guest',
    name: 'Guest',
    password: '',
    rights: [
      {
        role: 'read',
        path: '/',
        deny: false,
        exact: false
      }
    ]
  },

  /**
   * Initialize Rights module
   *
   * @return     {void}  Void
   */
  init () {
    let self = this

    db.onReady.then(() => {
      db.User.findOne({ provider: 'local', email: 'guest' }).then((u) => {
        if (u) {
          self.guest = u
        }
      })
    })
  },

  /**
   * Check user permissions for this request
   *
   * @param      {object}  req     The request object
   * @return     {object}  List of permissions for this request
   */
  check (req) {
    let self = this

    let perm = {
      read: false,
      write: false,
      manage: false
    }
    let rt = []
    let p = _.chain(req.originalUrl).toLower().trim().value()

    // Load user rights

    if (_.isArray(req.user.rights)) {
      rt = req.user.rights
    }

    // Check rights

    if (self.checkRole(p, rt, 'admin')) {
      perm.read = true
      perm.write = true
      perm.manage = true
    } else if (self.checkRole(p, rt, 'write')) {
      perm.read = true
      perm.write = true
    } else if (self.checkRole(p, rt, 'read')) {
      perm.read = true
    }

    return perm
  },

  /**
   * Check for a specific role based on list of user rights
   *
   * @param      {String}         p       Base path
   * @param      {array<object>}  rt      The user rights
   * @param      {string}         role    The minimum role required
   * @return     {boolean}        True if authorized
   */
  checkRole (p, rt, role) {
    if (_.find(rt, { role: 'admin' })) { return true }

    // Check specific role on path

    let filteredRights = _.filter(rt, (r) => {
      if (r.role === role || (r.role === 'write' && role === 'read')) {
        if ((!r.exact && _.startsWith(p, r.path)) || (r.exact && p === r.path)) {
          return true
        }
      }
      return false
    })

    // Check for deny scenario

    let isValid = false

    if (filteredRights.length > 1) {
      isValid = !_.chain(filteredRights).sortBy((r) => {
        return r.path.length + ((r.deny) ? 0.5 : 0)
      }).last().get('deny').value()
    } else if (filteredRights.length === 1 && filteredRights[0].deny === false) {
      isValid = true
    }

    // Deny by default

    return isValid
  }

}
