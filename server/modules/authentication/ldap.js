/* global WIKI */

// ------------------------------------
// LDAP Account
// ------------------------------------

const LdapStrategy = require('passport-ldapauth').Strategy
const fs = require('fs')

module.exports = {
  key: 'ldap',
  title: 'LDAP / Active Directory',
  useForm: true,
  props: {
    url: {
      type: String,
      default: 'ldap://serverhost:389'
    },
    bindDn: {
      type: String,
      default: `cn='root'`
    },
    bindCredentials: String,
    searchBase: {
      type: String,
      default: 'o=users,o=example.com'
    },
    searchFilter: {
      type: String,
      default: '(uid={{username}})'
    },
    tlsEnabled: {
      type: Boolean,
      default: false
    },
    tlsCertPath: String
  },
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
