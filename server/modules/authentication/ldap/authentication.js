/* global WIKI */

// ------------------------------------
// LDAP Account
// ------------------------------------

const LdapStrategy = require('passport-ldapauth').Strategy
const fs = require('fs')

module.exports = {
  init (passport, conf) {
    passport.use('ldapauth',
      new LdapStrategy({
        server: {
          url: conf.url,
          bindDn: conf.bindDn,
          bindCredentials: conf.bindCredentials,
          searchBase: conf.searchBase,
          searchFilter: conf.searchFilter,
          searchAttributes: ['displayName', 'name', 'cn', 'mail'],
          tlsOptions: (conf.tlsEnabled) ? {
            ca: [
              fs.readFileSync(conf.tlsCertPath)
            ]
          } : {}
        },
        usernameField: 'email',
        passReqToCallback: false
      }, (profile, cb) => {
        profile.provider = 'ldap'
        profile.id = profile.dn
        WIKI.db.users.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
