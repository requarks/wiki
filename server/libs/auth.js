'use strict'

/* global appconfig, appdata, db, lang, winston */

const fs = require('fs')

module.exports = function (passport) {
  // Serialization user methods

  passport.serializeUser(function (user, done) {
    done(null, user._id)
  })

  passport.deserializeUser(function (id, done) {
    db.User.findById(id).then((user) => {
      if (user) {
        done(null, user)
      } else {
        done(new Error(lang.t('auth:errors:usernotfound')), null)
      }
      return true
    }).catch((err) => {
      done(err, null)
    })
  })

  // Local Account

  if (appconfig.auth.local && appconfig.auth.local.enabled) {
    const LocalStrategy = require('passport-local').Strategy
    passport.use('local',
      new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
      }, (uEmail, uPassword, done) => {
        db.User.findOne({ email: uEmail, provider: 'local' }).then((user) => {
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

  if (appconfig.auth.google && appconfig.auth.google.enabled) {
    const GoogleStrategy = require('passport-google-oauth20').Strategy
    passport.use('google',
      new GoogleStrategy({
        clientID: appconfig.auth.google.clientId,
        clientSecret: appconfig.auth.google.clientSecret,
        callbackURL: appconfig.host + '/login/google/callback'
      }, (accessToken, refreshToken, profile, cb) => {
        db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Microsoft Accounts

  if (appconfig.auth.microsoft && appconfig.auth.microsoft.enabled) {
    const WindowsLiveStrategy = require('passport-windowslive').Strategy
    passport.use('windowslive',
      new WindowsLiveStrategy({
        clientID: appconfig.auth.microsoft.clientId,
        clientSecret: appconfig.auth.microsoft.clientSecret,
        callbackURL: appconfig.host + '/login/ms/callback'
      }, function (accessToken, refreshToken, profile, cb) {
        db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Facebook

  if (appconfig.auth.facebook && appconfig.auth.facebook.enabled) {
    const FacebookStrategy = require('passport-facebook').Strategy
    passport.use('facebook',
      new FacebookStrategy({
        clientID: appconfig.auth.facebook.clientId,
        clientSecret: appconfig.auth.facebook.clientSecret,
        callbackURL: appconfig.host + '/login/facebook/callback',
        profileFields: ['id', 'displayName', 'email']
      }, function (accessToken, refreshToken, profile, cb) {
        db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // GitHub

  if (appconfig.auth.github && appconfig.auth.github.enabled) {
    const GitHubStrategy = require('passport-github2').Strategy
    passport.use('github',
      new GitHubStrategy({
        clientID: appconfig.auth.github.clientId,
        clientSecret: appconfig.auth.github.clientSecret,
        callbackURL: appconfig.host + '/login/github/callback',
        scope: ['user:email']
      }, (accessToken, refreshToken, profile, cb) => {
        db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Slack

  if (appconfig.auth.slack && appconfig.auth.slack.enabled) {
    const SlackStrategy = require('passport-slack').Strategy
    passport.use('slack',
      new SlackStrategy({
        clientID: appconfig.auth.slack.clientId,
        clientSecret: appconfig.auth.slack.clientSecret,
        callbackURL: appconfig.host + '/login/slack/callback'
      }, (accessToken, refreshToken, profile, cb) => {
        db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // LDAP

  if (appconfig.auth.ldap && appconfig.auth.ldap.enabled) {
    const LdapStrategy = require('passport-ldapauth').Strategy
    passport.use('ldapauth',
      new LdapStrategy({
        server: {
          url: appconfig.auth.ldap.url,
          bindDn: appconfig.auth.ldap.bindDn,
          bindCredentials: appconfig.auth.ldap.bindCredentials,
          searchBase: appconfig.auth.ldap.searchBase,
          searchFilter: appconfig.auth.ldap.searchFilter,
          searchAttributes: ['displayName', 'name', 'cn', 'mail'],
          tlsOptions: (appconfig.auth.ldap.tlsEnabled) ? {
            ca: [
              fs.readFileSync(appconfig.auth.ldap.tlsCertPath)
            ]
          } : {}
        },
        usernameField: 'email',
        passReqToCallback: false
      }, (profile, cb) => {
        profile.provider = 'ldap'
        profile.id = profile.dn
        db.User.processProfile(profile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // AZURE AD

  if (appconfig.auth.azure && appconfig.auth.azure.enabled) {
    const AzureAdOAuth2Strategy = require('passport-azure-ad-oauth2').Strategy
    const jwt = require('jsonwebtoken')
    passport.use('azure_ad_oauth2',
      new AzureAdOAuth2Strategy({
        clientID: appconfig.auth.azure.clientId,
        clientSecret: appconfig.auth.azure.clientSecret,
        callbackURL: appconfig.host + '/login/azure/callback',
        resource: appconfig.auth.azure.resource,
        tenant: appconfig.auth.azure.tenant
      }, (accessToken, refreshToken, params, profile, cb) => {
        let waadProfile = jwt.decode(params.id_token)
        waadProfile.id = waadProfile.oid
        waadProfile.provider = 'azure'
        db.User.processProfile(waadProfile).then((user) => {
          return cb(null, user) || true
        }).catch((err) => {
          return cb(err, null) || true
        })
      }
      ))
  }

  // Create users for first-time

  db.onReady.then(() => {
    return db.User.findOne({ provider: 'local', email: 'guest' }).then((c) => {
      if (c < 1) {
        // Create guest account

        return db.User.create({
          provider: 'local',
          email: 'guest',
          name: 'Guest',
          password: '',
          rights: [{
            role: 'read',
            path: '/',
            exact: false,
            deny: !appconfig.public
          }]
        }).then(() => {
          winston.info('[AUTH] Guest account created successfully!')
        }).catch((err) => {
          winston.error('[AUTH] An error occured while creating guest account:')
          winston.error(err)
        })
      }
    }).then(() => {
      if (process.env.WIKI_JS_HEROKU) {
        return db.User.findOne({ provider: 'local', email: process.env.WIKI_ADMIN_EMAIL }).then((c) => {
          if (c < 1) {
            // Create root admin account (HEROKU ONLY)

            return db.User.create({
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
              winston.info('[AUTH] Root admin account created successfully!')
            }).catch((err) => {
              winston.error('[AUTH] An error occured while creating root admin account:')
              winston.error(err)
            })
          } else { return true }
        })
      } else { return true }
    })
  })
}
