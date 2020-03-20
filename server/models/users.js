/* global WIKI */

const bcrypt = require('bcryptjs-then')
const _ = require('lodash')
const tfa = require('node-2fa')
const jwt = require('jsonwebtoken')
const Model = require('objection').Model
const validate = require('validate.js')

const bcryptRegexp = /^\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/

/**
 * Users model
 */
module.exports = class User extends Model {
  static get tableName() { return 'users' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['email'],

      properties: {
        id: {type: 'integer'},
        email: {type: 'string', format: 'email'},
        name: {type: 'string', minLength: 1, maxLength: 255},
        providerId: {type: 'string'},
        password: {type: 'string'},
        tfaIsActive: {type: 'boolean', default: false},
        tfaSecret: {type: 'string'},
        jobTitle: {type: 'string'},
        location: {type: 'string'},
        pictureUrl: {type: 'string'},
        isSystem: {type: 'boolean'},
        isActive: {type: 'boolean'},
        isVerified: {type: 'boolean'},
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
      },
      provider: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./authentication'),
        join: {
          from: 'users.providerKey',
          to: 'authentication.key'
        }
      },
      defaultEditor: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./editors'),
        join: {
          from: 'users.editorKey',
          to: 'editors.key'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./locales'),
        join: {
          from: 'users.localeCode',
          to: 'locales.code'
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

  // ------------------------------------------------
  // Instance Methods
  // ------------------------------------------------

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

  getGlobalPermissions() {
    return _.uniq(_.flatten(_.map(this.groups, 'permissions')))
  }

  getGroups() {
    return _.uniq(_.map(this.groups, 'id'))
  }

  // ------------------------------------------------
  // Model Methods
  // ------------------------------------------------

  static async processProfile({ profile, providerKey }) {
    const provider = _.get(WIKI.auth.strategies, providerKey, {})
    provider.info = _.find(WIKI.data.authentication, ['key', providerKey])

    // Find existing user
    let user = await WIKI.models.users.query().findOne({
      providerId: _.toString(profile.id),
      providerKey
    })

    // Parse email
    let primaryEmail = ''
    if (_.isArray(profile.emails)) {
      const e = _.find(profile.emails, ['primary', true])
      primaryEmail = (e) ? e.value : _.first(profile.emails).value
    } else if (_.isString(profile.email) && profile.email.length > 5) {
      primaryEmail = profile.email
    } else if (_.isString(profile.mail) && profile.mail.length > 5) {
      primaryEmail = profile.mail
    } else if (profile.user && profile.user.email && profile.user.email.length > 5) {
      primaryEmail = profile.user.email
    } else {
      throw new Error('Missing or invalid email address from profile.')
    }
    primaryEmail = _.toLower(primaryEmail)

    // Find pending social user
    if (!user) {
      user = await WIKI.models.users.query().findOne({
        email: primaryEmail,
        providerId: null,
        providerKey
      })
      if (user) {
        user = await user.$query().patchAndFetch({
          providerId: _.toString(profile.id)
        })
      }
    }

    // Parse display name
    let displayName = ''
    if (_.isString(profile.displayName) && profile.displayName.length > 0) {
      displayName = profile.displayName
    } else if (_.isString(profile.name) && profile.name.length > 0) {
      displayName = profile.name
    } else {
      displayName = primaryEmail.split('@')[0]
    }

    // Parse picture URL
    let pictureUrl = _.truncate(_.get(profile, 'picture', _.get(user, 'pictureUrl', null)), {
      length: 255,
      omission: ''
    })

    // Update existing user
    if (user) {
      if (!user.isActive) {
        throw new WIKI.Error.AuthAccountBanned()
      }
      if (user.isSystem) {
        throw new Error('This is a system reserved account and cannot be used.')
      }

      user = await user.$query().patchAndFetch({
        email: primaryEmail,
        name: displayName,
        pictureUrl: pictureUrl
      })

      return user
    }

    // Self-registration
    if (provider.selfRegistration) {
      // Check if email domain is whitelisted
      if (_.get(provider, 'domainWhitelist', []).length > 0) {
        const emailDomain = _.last(primaryEmail.split('@'))
        if (!_.includes(provider.domainWhitelist, emailDomain)) {
          throw new WIKI.Error.AuthRegistrationDomainUnauthorized()
        }
      }

      // Create account
      user = await WIKI.models.users.query().insertAndFetch({
        providerKey: providerKey,
        providerId: _.toString(profile.id),
        email: primaryEmail,
        name: displayName,
        pictureUrl: pictureUrl,
        localeCode: WIKI.config.lang.code,
        defaultEditor: 'markdown',
        tfaIsActive: false,
        isSystem: false,
        isActive: true,
        isVerified: true
      })

      // Assign to group(s)
      if (provider.autoEnrollGroups.length > 0) {
        await user.$relatedQuery('groups').relate(provider.autoEnrollGroups)
      }

      return user
    }

    throw new Error('You are not authorized to login.')
  }

  static async login (opts, context) {
    if (_.has(WIKI.auth.strategies, opts.strategy)) {
      const strInfo = _.find(WIKI.data.authentication, ['key', opts.strategy])

      // Inject form user/pass
      if (strInfo.useForm) {
        _.set(context.req, 'body.email', opts.username)
        _.set(context.req, 'body.password', opts.password)
      }

      // Authenticate
      return new Promise((resolve, reject) => {
        WIKI.auth.passport.authenticate(opts.strategy, {
          session: !strInfo.useForm,
          scope: strInfo.scopes ? strInfo.scopes : null
        }, async (err, user, info) => {
          if (err) { return reject(err) }
          if (!user) { return reject(new WIKI.Error.AuthLoginFailed()) }

          // Must Change Password?
          if (user.mustChangePwd) {
            try {
              const pwdChangeToken = await WIKI.models.userKeys.generateToken({
                kind: 'changePwd',
                userId: user.id
              })

              return resolve({
                mustChangePwd: true,
                continuationToken: pwdChangeToken
              })
            } catch (errc) {
              WIKI.logger.warn(errc)
              return reject(new WIKI.Error.AuthGenericError())
            }
          }

          // Is 2FA required?
          if (user.tfaIsActive) {
            try {
              const tfaToken = await WIKI.models.userKeys.generateToken({
                kind: 'tfa',
                userId: user.id
              })
              return resolve({
                tfaRequired: true,
                continuationToken: tfaToken
              })
            } catch (errc) {
              WIKI.logger.warn(errc)
              return reject(new WIKI.Error.AuthGenericError())
            }
          }

          context.req.logIn(user, { session: !strInfo.useForm }, async errc => {
            if (errc) { return reject(errc) }
            const jwtToken = await WIKI.models.users.refreshToken(user)
            resolve({ jwt: jwtToken.token })
          })
        })(context.req, context.res, () => {})
      })
    } else {
      throw new WIKI.Error.AuthProviderInvalid()
    }
  }

  static async refreshToken(user) {
    if (_.isSafeInteger(user)) {
      user = await WIKI.models.users.query().findById(user).withGraphFetched('groups').modifyGraph('groups', builder => {
        builder.select('groups.id', 'permissions')
      })
      if (!user) {
        WIKI.logger.warn(`Failed to refresh token for user ${user}: Not found.`)
        throw new WIKI.Error.AuthGenericError()
      }
    } else if (_.isNil(user.groups)) {
      user.groups = await user.$relatedQuery('groups').select('groups.id', 'permissions')
    }

    return {
      token: jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        timezone: user.timezone,
        localeCode: user.localeCode,
        defaultEditor: user.defaultEditor,
        permissions: user.getGlobalPermissions(),
        groups: user.getGroups()
      }, {
        key: WIKI.config.certs.private,
        passphrase: WIKI.config.sessionSecret
      }, {
        algorithm: 'RS256',
        expiresIn: WIKI.config.auth.tokenExpiration,
        audience: WIKI.config.auth.audience,
        issuer: 'urn:wiki.js'
      }),
      user
    }
  }

  static async loginTFA (opts, context) {
    if (opts.securityCode.length === 6 && opts.loginToken.length === 64) {
      let result = await WIKI.redis.get(`tfa:${opts.loginToken}`)
      if (result) {
        let userId = _.toSafeInteger(result)
        if (userId && userId > 0) {
          let user = await WIKI.models.users.query().findById(userId)
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

  /**
   * Change Password from a Mandatory Password Change after Login
   */
  static async loginChangePassword ({ continuationToken, newPassword }, context) {
    if (!newPassword || newPassword.length < 6) {
      throw new WIKI.Error.InputInvalid('Password must be at least 6 characters!')
    }
    const usr = await WIKI.models.userKeys.validateToken({
      kind: 'changePwd',
      token: continuationToken
    })

    if (usr) {
      await WIKI.models.users.query().patch({
        password: newPassword,
        mustChangePwd: false
      }).findById(usr.id)

      return new Promise((resolve, reject) => {
        context.req.logIn(usr, { session: false }, async err => {
          if (err) { return reject(err) }
          const jwtToken = await WIKI.models.users.refreshToken(usr)
          resolve({ jwt: jwtToken.token })
        })
      })
    } else {
      throw new WIKI.Error.UserNotFound()
    }
  }

  /**
   * Create a new user
   *
   * @param {Object} param0 User Fields
   */
  static async createNewUser ({ providerKey, email, passwordRaw, name, groups, mustChangePassword, sendWelcomeEmail }) {
    // Input sanitization
    email = _.toLower(email)

    // Input validation
    let validation = null
    if (providerKey === 'local') {
      validation = validate({
        email,
        passwordRaw,
        name
      }, {
        email: {
          email: true,
          length: {
            maximum: 255
          }
        },
        passwordRaw: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 6
          }
        },
        name: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
      }, { format: 'flat' })
    } else {
      validation = validate({
        email,
        name
      }, {
        email: {
          email: true,
          length: {
            maximum: 255
          }
        },
        name: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
      }, { format: 'flat' })
    }

    if (validation && validation.length > 0) {
      throw new WIKI.Error.InputInvalid(validation[0])
    }

    // Check if email already exists
    const usr = await WIKI.models.users.query().findOne({ email, providerKey })
    if (!usr) {
      // Create the account
      let newUsrData = {
        providerKey,
        email,
        name,
        locale: 'en',
        defaultEditor: 'markdown',
        tfaIsActive: false,
        isSystem: false,
        isActive: true,
        isVerified: true,
        mustChangePwd: false
      }

      if (providerKey === `local`) {
        newUsrData.password = passwordRaw
        newUsrData.mustChangePwd = (mustChangePassword === true)
      }

      const newUsr = await WIKI.models.users.query().insert(newUsrData)

      // Assign to group(s)
      if (groups.length > 0) {
        await newUsr.$relatedQuery('groups').relate(groups)
      }

      if (sendWelcomeEmail) {
        // Send welcome email
        await WIKI.mail.send({
          template: 'accountWelcome',
          to: email,
          subject: `Welcome to the wiki ${WIKI.config.title}`,
          data: {
            preheadertext: `You've been invited to the wiki ${WIKI.config.title}`,
            title: `You've been invited to the wiki ${WIKI.config.title}`,
            content: `Click the button below to access the wiki.`,
            buttonLink: `${WIKI.config.host}/login`,
            buttonText: 'Login'
          },
          text: `You've been invited to the wiki ${WIKI.config.title}: ${WIKI.config.host}/login`
        })
      }
    } else {
      throw new WIKI.Error.AuthAccountAlreadyExists()
    }
  }

  /**
   * Update an existing user
   *
   * @param {Object} param0 User ID and fields to update
   */
  static async updateUser ({ id, email, name, newPassword, groups, location, jobTitle, timezone }) {
    const usr = await WIKI.models.users.query().findById(id)
    if (usr) {
      let usrData = {}
      if (!_.isEmpty(email) && email !== usr.email) {
        const dupUsr = await WIKI.models.users.query().select('id').where({
          email,
          providerKey: usr.providerKey
        }).first()
        if (dupUsr) {
          throw new WIKI.Error.AuthAccountAlreadyExists()
        }
        usrData.email = email
      }
      if (!_.isEmpty(name) && name !== usr.name) {
        usrData.name = _.trim(name)
      }
      if (!_.isEmpty(newPassword)) {
        if (newPassword.length < 6) {
          throw new WIKI.Error.InputInvalid('Password must be at least 6 characters!')
        }
        usrData.password = newPassword
      }
      if (_.isArray(groups)) {
        const usrGroupsRaw = await usr.$relatedQuery('groups')
        const usrGroups = _.map(usrGroupsRaw, 'id')
        // Relate added groups
        const addUsrGroups = _.difference(groups, usrGroups)
        for (const grp of addUsrGroups) {
          await usr.$relatedQuery('groups').relate(grp)
        }
        // Unrelate removed groups
        const remUsrGroups = _.difference(usrGroups, groups)
        for (const grp of remUsrGroups) {
          await usr.$relatedQuery('groups').unrelate().where('groupId', grp)
        }
      }
      if (!_.isEmpty(location) && location !== usr.location) {
        usrData.location = _.trim(location)
      }
      if (!_.isEmpty(jobTitle) && jobTitle !== usr.jobTitle) {
        usrData.jobTitle = _.trim(jobTitle)
      }
      if (!_.isEmpty(timezone) && timezone !== usr.timezone) {
        usrData.timezone = timezone
      }
      await WIKI.models.users.query().patch(usrData).findById(id)
    } else {
      throw new WIKI.Error.UserNotFound()
    }
  }

  /**
   * Delete a User
   *
   * @param {*} id User ID
   */
  static async deleteUser (id) {
    const usr = await WIKI.models.users.query().findById(id)
    if (usr) {
      await WIKI.models.userKeys.query().delete().where('userId', id)
      await WIKI.models.users.query().deleteById(id)
    } else {
      throw new WIKI.Error.UserNotFound()
    }
  }

  /**
   * Register a new user (client-side registration)
   *
   * @param {Object} param0 User fields
   * @param {Object} context GraphQL Context
   */
  static async register ({ email, password, name, verify = false, bypassChecks = false }, context) {
    const localStrg = await WIKI.models.authentication.getStrategy('local')
    // Check if self-registration is enabled
    if (localStrg.selfRegistration || bypassChecks) {
      // Input sanitization
      email = _.toLower(email)

      // Input validation
      const validation = validate({
        email,
        password,
        name
      }, {
        email: {
          email: true,
          length: {
            maximum: 255
          }
        },
        password: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 6
          }
        },
        name: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
      }, { format: 'flat' })
      if (validation && validation.length > 0) {
        throw new WIKI.Error.InputInvalid(validation[0])
      }

      // Check if email domain is whitelisted
      if (_.get(localStrg, 'domainWhitelist.v', []).length > 0 && !bypassChecks) {
        const emailDomain = _.last(email.split('@'))
        if (!_.includes(localStrg.domainWhitelist.v, emailDomain)) {
          throw new WIKI.Error.AuthRegistrationDomainUnauthorized()
        }
      }
      // Check if email already exists
      const usr = await WIKI.models.users.query().findOne({ email, providerKey: 'local' })
      if (!usr) {
        // Create the account
        const newUsr = await WIKI.models.users.query().insert({
          provider: 'local',
          email,
          name,
          password,
          locale: 'en',
          defaultEditor: 'markdown',
          tfaIsActive: false,
          isSystem: false,
          isActive: true,
          isVerified: false
        })

        // Assign to group(s)
        if (_.get(localStrg, 'autoEnrollGroups.v', []).length > 0) {
          await newUsr.$relatedQuery('groups').relate(localStrg.autoEnrollGroups.v)
        }

        if (verify) {
          // Create verification token
          const verificationToken = await WIKI.models.userKeys.generateToken({
            kind: 'verify',
            userId: newUsr.id
          })

          // Send verification email
          await WIKI.mail.send({
            template: 'accountVerify',
            to: email,
            subject: 'Verify your account',
            data: {
              preheadertext: 'Verify your account in order to gain access to the wiki.',
              title: 'Verify your account',
              content: 'Click the button below in order to verify your account and gain access to the wiki.',
              buttonLink: `${WIKI.config.host}/verify/${verificationToken}`,
              buttonText: 'Verify'
            },
            text: `You must open the following link in your browser to verify your account and gain access to the wiki: ${WIKI.config.host}/verify/${verificationToken}`
          })
        }
        return true
      } else {
        throw new WIKI.Error.AuthAccountAlreadyExists()
      }
    } else {
      throw new WIKI.Error.AuthRegistrationDisabled()
    }
  }

  static async getGuestUser () {
    const user = await WIKI.models.users.query().findById(2).withGraphJoined('groups').modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions')
    })
    if (!user) {
      WIKI.logger.error('CRITICAL ERROR: Guest user is missing!')
      process.exit(1)
    }
    user.permissions = user.getGlobalPermissions()
    return user
  }

  static async getRootUser () {
    let user = await WIKI.models.users.query().findById(1)
    if (!user) {
      WIKI.logger.error('CRITICAL ERROR: Root Administrator user is missing!')
      process.exit(1)
    }
    user.permissions = ['manage:system']
    return user
  }
}
