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
  let name = ''
  if (_.isArray(profile.emails)) {
    let e = _.find(profile.emails, ['primary', true])
    primaryEmail = (e) ? e.value : _.first(profile.emails).value
  } else if (_.isString(profile.email) && profile.email.length > 5) {
    primaryEmail = profile.email
  } else if (_.isString(profile.mail) && profile.mail.length > 5) {
    primaryEmail = profile.mail
  } else if (profile.user && profile.user.email && profile.user.email.length > 5) {
    primaryEmail = profile.user.email
  } else if (_.isString(profile.unique_name) && profile.unique_name.length > 5) {
    primaryEmail = profile.unique_name
  } else {
    return Promise.reject(new Error(lang.t('auth:errors.invaliduseremail')))
  }

  profile.provider = _.lowerCase(profile.provider)
  primaryEmail = _.toLower(primaryEmail)

  if (_.has(profile, 'displayName')) {
    name = profile.displayName
  } else if (_.has(profile, 'name')) {
    name = profile.name
  } else if (_.has(profile, 'cn')) {
    name = profile.cn
  } else {
    name = _.split(primaryEmail, '@')[0]
  }

  return db.User.findOneAndUpdate({
    email: primaryEmail,
    provider: profile.provider
  }, {
    email: primaryEmail,
    provider: profile.provider,
    providerId: profile.id,
    name
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
        name,
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
