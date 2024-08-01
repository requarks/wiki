/* global WIKI */

// ------------------------------------
// LDAP Account
// ------------------------------------

const LdapStrategy = require('passport-ldapauth').Strategy
const fs = require('fs')
const _ = require('lodash')

module.exports = {
  init (passport, conf) {
    passport.use(conf.key,
      new LdapStrategy({
        server: {
          url: conf.url,
          bindDn: conf.bindDn,
          bindCredentials: conf.bindCredentials,
          searchBase: conf.searchBase,
          searchFilter: conf.searchFilter,
          tlsOptions: getTlsOptions(conf),
          ...conf.mapGroups && {
            groupSearchBase: conf.groupSearchBase,
            groupSearchFilter: conf.groupSearchFilter,
            groupSearchScope: conf.groupSearchScope,
            groupDnProperty: conf.groupDnProperty,
            groupSearchAttributes: [conf.groupNameField]
          },
          includeRaw: true
        },
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
      }, async (req, profile, cb) => {
        try {
          const userId = _.get(profile, conf.mappingUID, null)
          if (!userId) {
            throw new Error('Invalid Unique ID field mapping!')
          }

          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              id: userId,
              email: String(_.get(profile, conf.mappingEmail, '')).split(',')[0],
              displayName: _.get(profile, conf.mappingDisplayName, '???'),
              picture: _.get(profile, `_raw.${conf.mappingPicture}`, '')
            }
          })
          // map users LDAP groups to wiki groups with the same name, and remove any groups that don't match LDAP
          if (conf.mapGroups) {
            const ldapGroups = _.get(profile, '_groups')
            if (ldapGroups && _.isArray(ldapGroups)) {
              const groups = ldapGroups.map(g => g[conf.groupNameField])
              const currentGroups = (await user.$relatedQuery('groups').select('groups.id')).map(g => g.id)
              const expectedGroups = Object.values(WIKI.auth.groups).filter(g => groups.includes(g.name)).map(g => g.id)
              for (const groupId of _.difference(expectedGroups, currentGroups)) {
                await user.$relatedQuery('groups').relate(groupId)
              }
              for (const groupId of _.difference(currentGroups, expectedGroups)) {
                await user.$relatedQuery('groups').unrelate().where('groupId', groupId)
              }
            }
          }
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

function getTlsOptions(conf) {
  if (!conf.tlsEnabled) {
    return {}
  }

  if (!conf.tlsCertPath) {
    return {
      rejectUnauthorized: conf.verifyTLSCertificate
    }
  }

  const caList = []
  if (conf.verifyTLSCertificate) {
    caList.push(fs.readFileSync(conf.tlsCertPath))
  }

  return {
    rejectUnauthorized: conf.verifyTLSCertificate,
    ca: caList
  }
}
