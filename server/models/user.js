/* global wiki */

const Promise = require('bluebird')
const bcrypt = require('bcryptjs-then')
const _ = require('lodash')

/**
 * Users schema
 */
module.exports = (sequelize, DataTypes) => {
  let userSchema = sequelize.define('user', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false
    },
    providerId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('admin', 'user', 'guest'),
      allowNull: false
    },
    tfaIsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    tfaSecret: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    timestamps: true,
    version: true,
    indexes: [
      {
        unique: true,
        fields: ['provider', 'email']
      }
    ]
  })

  userSchema.prototype.validatePassword = function (rawPwd) {
    return bcrypt.compare(rawPwd, this.password).then((isValid) => {
      return (isValid) ? true : Promise.reject(new Error(wiki.lang.t('auth:errors:invalidlogin')))
    })
  }

  userSchema.processProfile = (profile) => {
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
      return Promise.reject(new Error(wiki.lang.t('auth:errors.invaliduseremail')))
    }

    profile.provider = _.lowerCase(profile.provider)
    primaryEmail = _.toLower(primaryEmail)

    return wiki.db.User.findOneAndUpdate({
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
        return wiki.db.User.create(nUsr)
      }
      return user || Promise.reject(new Error(wiki.lang.t('auth:errors:notyetauthorized')))
    })
  }

  userSchema.hashPassword = (rawPwd) => {
    return bcrypt.hash(rawPwd)
  }

  return userSchema
}
