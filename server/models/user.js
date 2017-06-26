'use strict'

/* global db, lang */

const Mongoose = require('mongoose')
const Promise = require('bluebird')
const bcrypt = require('bcryptjs-then')
const _ = require('lodash')

/**
 * Users schema
 *
 * @type       {<Mongoose.Schema>}
 */
var userSchema = Mongoose.Schema({

  email: {
    type: String,
    required: true,
    index: true
  },

  provider: {
    type: String,
    required: true
  },

  providerId: {
    type: String
  },

  password: {
    type: String
  },

  name: {
    type: String
  },

  rights: [{
    role: String,
    path: String,
    exact: Boolean,
    deny: Boolean
  }]

}, { timestamps: {} })

userSchema.statics.processProfile = (profile) => {
  let primaryEmail = ''
  if (_.isArray(profile.emails)) {
    let e = _.find(profile.emails, ['primary', true])
    primaryEmail = (e) ? e.value : _.first(profile.emails).value
  } else if (_.isString(profile.email) && profile.email.length > 5) {
    primaryEmail = profile.email
  } else if (_.isString(profile.mail) && profile.mail.length > 5) {
    primaryEmail = profile.mail
  } else if (profile.user && profile.user.email && profile.user.email.length > 5) {
    primaryEmail = profile.user.email
  } else {
    return Promise.reject(new Error(lang.t('auth:errors.invaliduseremail')))
  }

  profile.provider = _.lowerCase(profile.provider)
  primaryEmail = _.toLower(primaryEmail)

  return db.User.findOneAndUpdate({
    email: primaryEmail,
    provider: profile.provider
  }, {
    email: primaryEmail,
    provider: profile.provider,
    providerId: profile.id,
    name: profile.displayName || _.split(primaryEmail, '@')[0]
  }, {
    new: true
  }).then((user) => {
    // Handle unregistered accounts
    if (!user && profile.provider !== 'local' && (appconfig.auth.defaultReadAccess || profile.provider === 'ldap' || profile.provider === 'azure')) {
      let nUsr = {
        email: primaryEmail,
        provider: profile.provider,
        providerId: profile.id,
        password: '',
        name: profile.displayName || profile.name || profile.cn,
        rights: [{
          role: 'read',
          path: '/',
          exact: false,
          deny: false
        }]
      }
      return db.User.create(nUsr)
    }
    return user || Promise.reject(new Error(lang.t('auth:errors:notyetauthorized')))
  })
}

userSchema.statics.hashPassword = (rawPwd) => {
  return bcrypt.hash(rawPwd)
}

userSchema.methods.validatePassword = function (rawPwd) {
  return bcrypt.compare(rawPwd, this.password).then((isValid) => {
    return (isValid) ? true : Promise.reject(new Error(lang.t('auth:errors:invalidlogin')))
  })
}

module.exports = Mongoose.model('User', userSchema)
