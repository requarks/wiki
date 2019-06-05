/* global WIKI */

// ------------------------------------
// LDAP Account
// ------------------------------------

const LdapStrategy = require('passport-ldapauth').Strategy
const fs = require('fs')
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use('ldap',
      new LdapStrategy({
        server: {
          url: conf.url,
          bindDn: conf.bindDn,
          bindCredentials: conf.bindCredentials,
          searchBase: conf.searchBase,
          searchFilter: conf.searchFilter,
          tlsOptions: (conf.tlsEnabled) ? {
            ca: [
              fs.readFileSync(conf.tlsCertPath)
            ]
          } : {}
        },
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: false
      }, async (profile, cb) => {
        try {
          const userId = _.get(profile, conf.mappingUID, null)
          if (!userId) {
            throw new Error('Invalid Unique ID field mapping!')
          }

          const user = await WIKI.models.users.processProfile({
            profile: {
              id: userId,
              email: _.get(profile, conf.mappingEmail, ''),
              displayName: _.get(profile, conf.mappingDisplayName, '???'),
              picture: _.get(profile, conf.mappingPicture, '')
            },
            providerKey: 'ldap'
          })
          cb(null, user)
        } catch (err) {
          if (WIKI.config.flags.ldapdebug) {
            WIKI.logger.warn('LDAP LOGIN ERROR (c2): ', err)
          }
          cb(err, null)
        }
      }
      ))
  }
}
