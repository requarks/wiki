'use strict'

/* global wiki */

// ------------------------------------
// LDAP Account
// ------------------------------------

const LdapStrategy = require('passport-ldapauth').Strategy

module.exports = (passport) => {
  if (wiki.config.auth.ldap && wiki.config.auth.ldap.enabled) {
    passport.use('ldapauth',
      new LdapStrategy({
        server: {
          url: wiki.config.auth.ldap.url,
          bindDn: wiki.config.auth.ldap.bindDn,
          bindCredentials: wiki.config.auth.ldap.bindCredentials,
          searchBase: wiki.config.auth.ldap.searchBase,
          searchFilter: wiki.config.auth.ldap.searchFilter,
          searchAttributes: ['displayName', 'name', 'cn', 'mail'],
          tlsOptions: (wiki.config.auth.ldap.tlsEnabled) ? {
            ca: [
              fs.readFileSync(wiki.config.auth.ldap.tlsCertPath)
            ]
          } : {}
        },
        usernameField: 'email',
        passReqToCallback: false
      }, (profile, cb) => {
        profile.provider = 'ldap'
        profile.id = profile.dn
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }
}
