/* global WIKI */

const bcrypt = require('bcryptjs-then')
const _ = require('lodash')
const tfa = require('node-2fa')
const securityHelper = require('../../helpers/security')
const Model = require('objection').Model

const bcryptRegexp = /^\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/

/**
 * Users model
 */
module.exports = class User extends Model {
  static get tableName() { return 'users' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['email', 'name', 'provider'],

      properties: {
        id: {type: 'integer'},
        email: {type: 'string', format: 'email'},
        name: {type: 'string', minLength: 1, maxLength: 255},
        provider: {type: 'string', minLength: 1, maxLength: 255},
        providerId: {type: 'number'},
        password: {type: 'string'},
        role: {type: 'string', enum: ['admin', 'guest', 'user']},
        tfaIsActive: {type: 'boolean', default: false},
        tfaSecret: {type: 'string'},
        locale: {type: 'string'},
        jobTitle: {type: 'string'},
        location: {type: 'string'},
        pictureUrl: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      groups: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./groups'),
        join: {
          from: 'users.id',
          through: {
            from: 'userGroups.userId',
            to: 'userGroups.groupId'
          },
          to: 'groups.id'
        }
      }
    }
  }

  async $beforeUpdate(opt, context) {
    await super.$beforeUpdate(opt, context)

    this.updatedAt = new Date().toISOString()

    if (!(opt.patch && this.password === undefined)) {
      await this.generateHash()
    }
  }
  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()

    await this.generateHash()
  }

  async generateHash() {
    if (this.password) {
      if (bcryptRegexp.test(this.password)) { return }
      this.password = await bcrypt.hash(this.password, 12)
    }
  }

  async verifyPassword(pwd) {
    if (await bcrypt.compare(pwd, this.password) === true) {
      return true
    } else {
      throw new WIKI.Error.AuthLoginFailed()
    }
  }

  async enableTFA() {
    let tfaInfo = tfa.generateSecret({
      name: WIKI.config.site.title
    })
    return this.$query.patch({
      tfaIsActive: true,
      tfaSecret: tfaInfo.secret
    })
  }

  async disableTFA() {
    return this.$query.patch({
      tfaIsActive: false,
      tfaSecret: ''
    })
  }

  async verifyTFA(code) {
    let result = tfa.verifyToken(this.tfaSecret, code)
    return (result && _.has(result, 'delta') && result.delta === 0)
  }

  static async processProfile(profile) {
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
      return Promise.reject(new Error(WIKI.lang.t('auth:errors.invaliduseremail')))
    }

    profile.provider = _.lowerCase(profile.provider)
    primaryEmail = _.toLower(primaryEmail)

    let user = await WIKI.db.users.query().findOne({
      email: primaryEmail,
      provider: profile.provider
    })
    if (user) {
      user.$query().patchAdnFetch({
        email: primaryEmail,
        provider: profile.provider,
        providerId: profile.id,
        name: profile.displayName || _.split(primaryEmail, '@')[0]
      })
    } else {
      user = await WIKI.db.users.query().insertAndFetch({
        email: primaryEmail,
        provider: profile.provider,
        providerId: profile.id,
        name: profile.displayName || _.split(primaryEmail, '@')[0]
      })
    }

    // Handle unregistered accounts
    // if (!user && profile.provider !== 'local' && (WIKI.config.auth.defaultReadAccess || profile.provider === 'ldap' || profile.provider === 'azure')) {
    //   let nUsr = {
    //     email: primaryEmail,
    //     provider: profile.provider,
    //     providerId: profile.id,
    //     password: '',
    //     name: profile.displayName || profile.name || profile.cn,
    //     rights: [{
    //       role: 'read',
    //       path: '/',
    //       exact: false,
    //       deny: false
    //     }]
    //   }
    //   return WIKI.db.users.query().insert(nUsr)
    // }

    return user
  }

  static async login (opts, context) {
    if (_.has(WIKI.config.auth.strategies, opts.provider)) {
      _.set(context.req, 'body.email', opts.username)
      _.set(context.req, 'body.password', opts.password)

      // Authenticate
      return new Promise((resolve, reject) => {
        WIKI.auth.passport.authenticate(opts.provider, async (err, user, info) => {
          if (err) { return reject(err) }
          if (!user) { return reject(new WIKI.Error.AuthLoginFailed()) }

          // Is 2FA required?
          if (user.tfaIsActive) {
            try {
              let loginToken = await securityHelper.generateToken(32)
              await WIKI.redis.set(`tfa:${loginToken}`, user.id, 'EX', 600)
              return resolve({
                tfaRequired: true,
                tfaLoginToken: loginToken
              })
            } catch (err) {
              WIKI.logger.warn(err)
              return reject(new WIKI.Error.AuthGenericError())
            }
          } else {
            // No 2FA, log in user
            return context.req.logIn(user, err => {
              if (err) { return reject(err) }
              resolve({
                tfaRequired: false
              })
            })
          }
        })(context.req, context.res, () => {})
      })
    } else {
      throw new WIKI.Error.AuthProviderInvalid()
    }
  }

  static async loginTFA(opts, context) {
    if (opts.securityCode.length === 6 && opts.loginToken.length === 64) {
      let result = await WIKI.redis.get(`tfa:${opts.loginToken}`)
      if (result) {
        let userId = _.toSafeInteger(result)
        if (userId && userId > 0) {
          let user = await WIKI.db.users.query().findById(userId)
          if (user && user.verifyTFA(opts.securityCode)) {
            return Promise.fromCallback(clb => {
              context.req.logIn(user, clb)
            }).return({
              succeeded: true,
              message: 'Login Successful'
            }).catch(err => {
              WIKI.logger.warn(err)
              throw new WIKI.Error.AuthGenericError()
            })
          } else {
            throw new WIKI.Error.AuthTFAFailed()
          }
        }
      }
    }
    throw new WIKI.Error.AuthTFAInvalid()
  }
}
