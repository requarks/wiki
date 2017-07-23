'use strict'

/* global wiki */

const fs = require('fs')

module.exports = function (passport) {
  // Serialization user methods

  passport.serializeUser(function (user, done) {
    done(null, user._id)
  })

  passport.deserializeUser(function (id, done) {
    wiki.db.User.findById(id).then((user) => {
      if (user) {
        done(null, user)
      } else {
        done(new Error(wiki.lang.t('auth:errors:usernotfound')), null)
      }
      return true
    }).catch((err) => {
      done(err, null)
    })
  })

  // Local Account

  if (wiki.config.auth.local && wiki.config.auth.local.enabled) {
    const LocalStrategy = require('passport-local').Strategy
    passport.use('local',
      new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
      }, (uEmail, uPassword, done) => {
        wiki.db.User.findOne({ email: uEmail, provider: 'local' }).then((user) => {
          if (user) {
            return user.validatePassword(uPassword).then(() => {
              return done(null, user) || true
            }).catch((err) => {
              return done(err, null)
            })
          } else {
            return done(new Error('INVALID_LOGIN'), null)
          }
        }).catch((err) => {
          done(err, null)
        })
      }
      ))
  }

  // Google ID

  if (wiki.config.auth.google && wiki.config.auth.google.enabled) {
    const GoogleStrategy = require('passport-google-oauth20').Strategy
    passport.use('google',
      new GoogleStrategy({
        clientID: wiki.config.auth.google.clientId,
        clientSecret: wiki.config.auth.google.clientSecret,
        callbackURL: wiki.config.host + '/login/google/callback'
      }, (accessToken, refreshToken, profile, cb) => {
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Microsoft Accounts

  if (wiki.config.auth.microsoft && wiki.config.auth.microsoft.enabled) {
    const WindowsLiveStrategy = require('passport-windowslive').Strategy
    passport.use('windowslive',
      new WindowsLiveStrategy({
        clientID: wiki.config.auth.microsoft.clientId,
        clientSecret: wiki.config.auth.microsoft.clientSecret,
        callbackURL: wiki.config.host + '/login/ms/callback'
      }, function (accessToken, refreshToken, profile, cb) {
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Facebook

  if (wiki.config.auth.facebook && wiki.config.auth.facebook.enabled) {
    const FacebookStrategy = require('passport-facebook').Strategy
    passport.use('facebook',
      new FacebookStrategy({
        clientID: wiki.config.auth.facebook.clientId,
        clientSecret: wiki.config.auth.facebook.clientSecret,
        callbackURL: wiki.config.host + '/login/facebook/callback',
        profileFields: ['id', 'displayName', 'email']
      }, function (accessToken, refreshToken, profile, cb) {
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // GitHub

  if (wiki.config.auth.github && wiki.config.auth.github.enabled) {
    const GitHubStrategy = require('passport-github2').Strategy
    passport.use('github',
      new GitHubStrategy({
        clientID: wiki.config.auth.github.clientId,
        clientSecret: wiki.config.auth.github.clientSecret,
        callbackURL: wiki.config.host + '/login/github/callback',
        scope: ['user:email']
      }, (accessToken, refreshToken, profile, cb) => {
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Slack

  if (wiki.config.auth.slack && wiki.config.auth.slack.enabled) {
    const SlackStrategy = require('passport-slack').Strategy
    passport.use('slack',
      new SlackStrategy({
        clientID: wiki.config.auth.slack.clientId,
        clientSecret: wiki.config.auth.slack.clientSecret,
        callbackURL: wiki.config.host + '/login/slack/callback'
      }, (accessToken, refreshToken, profile, cb) => {
        wiki.db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // LDAP

  if (wiki.config.auth.ldap && wiki.config.auth.ldap.enabled) {
    const LdapStrategy = require('passport-ldapauth').Strategy
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

  // AZURE AD

  if (wiki.config.auth.azure && wiki.config.auth.azure.enabled) {
    const AzureAdOAuth2Strategy = require('passport-azure-ad-oauth2').Strategy
    const jwt = require('jsonwebtoken')
    passport.use('azure_ad_oauth2',
      new AzureAdOAuth2Strategy({
        clientID: wiki.config.auth.azure.clientId,
        clientSecret: wiki.config.auth.azure.clientSecret,
        callbackURL: wiki.config.host + '/login/azure/callback',
        resource: wiki.config.auth.azure.resource,
        tenant: wiki.config.auth.azure.tenant
      }, (accessToken, refreshToken, params, profile, cb) => {
        let waadProfile = jwt.decode(params.id_token)
        waadProfile.id = waadProfile.oid
        waadProfile.provider = 'azure'
        wiki.db.User.processProfile(waadProfile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Create users for first-time

  wiki.db.onReady.then(() => {
    return wiki.db.User.findOne({ provider: 'local', email: 'guest' }).then((c) => {
      if (c < 1) {
        // Create guest account

        return wiki.db.User.create({
          provider: 'local',
          email: 'guest',
          name: 'Guest',
          password: '',
          rights: [{
            role: 'read',
            path: '/',
            exact: false,
            deny: !wiki.config.public
          }]
        }).then(() => {
          wiki.logger.info('[AUTH] Guest account created successfully!')
        }).catch((err) => {
          wiki.logger.error('[AUTH] An error occured while creating guest account:')
          wiki.logger.error(err)
        })
      }
    }).then(() => {
      if (process.env.WIKI_JS_HEROKU) {
        return wiki.db.User.findOne({ provider: 'local', email: process.env.WIKI_ADMIN_EMAIL }).then((c) => {
          if (c < 1) {
            // Create root admin account (HEROKU ONLY)

            return wiki.db.User.create({
              provider: 'local',
              email: process.env.WIKI_ADMIN_EMAIL,
              name: 'Administrator',
              password: '$2a$04$MAHRw785Xe/Jd5kcKzr3D.VRZDeomFZu2lius4gGpZZ9cJw7B7Mna', // admin123 (default)
              rights: [{
                role: 'admin',
                path: '/',
                exact: false,
                deny: false
              }]
            }).then(() => {
              wiki.logger.info('[AUTH] Root admin account created successfully!')
            }).catch((err) => {
              wiki.logger.error('[AUTH] An error occured while creating root admin account:')
              wiki.logger.error(err)
            })
          } else { return true }
        })
      } else { return true }
    })
  })
}
