/* global WIKI */

import { difference, find, first, flatten, flattenDeep, get, has, isArray, isEmpty, isNil, isString, last, set, toString, truncate, uniq } from 'lodash-es'
import tfa from 'node-2fa'
import jwt from 'jsonwebtoken'
import { Model } from 'objection'
import validate from 'validate.js'
import qr from 'qr-image'
import bcrypt from 'bcryptjs'

import { Group } from './groups.mjs'
import { Locale } from './locales.mjs'

/**
 * Users model
 */
export class User extends Model {
  static get tableName() { return 'users' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['email'],

      properties: {
        id: {type: 'string'},
        email: {type: 'string'},
        name: {type: 'string', minLength: 1, maxLength: 255},
        pictureUrl: {type: 'string'},
        isSystem: {type: 'boolean'},
        isActive: {type: 'boolean'},
        isVerified: {type: 'boolean'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['auth', 'meta', 'prefs']
  }

  static get relationMappings() {
    return {
      groups: {
        relation: Model.ManyToManyRelation,
        modelClass: Group,
        join: {
          from: 'users.id',
          through: {
            from: 'userGroups.userId',
            to: 'userGroups.groupId'
          },
          to: 'groups.id'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: Locale,
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
  }
  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  // ------------------------------------------------
  // Instance Methods
  // ------------------------------------------------

  async generateTFA() {
    let tfaInfo = tfa.generateSecret({
      name: WIKI.config.title,
      account: this.email
    })
    await WIKI.db.users.query().findById(this.id).patch({
      tfaIsActive: false,
      tfaSecret: tfaInfo.secret
    })
    const safeTitle = WIKI.config.title.replace(/[\s-.,=!@#$%?&*()+[\]{}/\\;<>]/g, '')
    return qr.imageSync(`otpauth://totp/${safeTitle}:${this.email}?secret=${tfaInfo.secret}`, { type: 'svg' })
  }

  async enableTFA() {
    return WIKI.db.users.query().findById(this.id).patch({
      tfaIsActive: true
    })
  }

  async disableTFA() {
    return this.$query.patch({
      tfaIsActive: false,
      tfaSecret: ''
    })
  }

  verifyTFA(code) {
    let result = tfa.verifyToken(this.tfaSecret, code)
    return (result && has(result, 'delta') && result.delta === 0)
  }

  getPermissions () {
    return uniq(flatten(this.groups.map(g => g.permissions)))
  }

  getGroups() {
    return uniq(this.groups.map(g => g.id))
  }

  // ------------------------------------------------
  // Model Methods
  // ------------------------------------------------

  static async getById(id) {
    return WIKI.db.users.query().findById(id).withGraphFetched('groups').modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions')
    })
  }

  static async processProfile({ profile, providerKey }) {
    const provider = get(WIKI.auth.strategies, providerKey, {})
    provider.info = find(WIKI.data.authentication, ['key', provider.stategyKey])

    // Find existing user
    let user = await WIKI.db.users.query().findOne({
      providerId: toString(profile.id),
      providerKey
    })

    // Parse email
    let primaryEmail = ''
    if (isArray(profile.emails)) {
      const e = find(profile.emails, ['primary', true])
      primaryEmail = (e) ? e.value : first(profile.emails).value
    } else if (isArray(profile.email)) {
      primaryEmail = first(flattenDeep([profile.email]))
    } else if (isString(profile.email) && profile.email.length > 5) {
      primaryEmail = profile.email
    } else if (isString(profile.mail) && profile.mail.length > 5) {
      primaryEmail = profile.mail
    } else if (profile.user && profile.user.email && profile.user.email.length > 5) {
      primaryEmail = profile.user.email
    } else {
      throw new Error('Missing or invalid email address from profile.')
    }
    primaryEmail = primaryEmail.toLowerCase()

    // Find pending social user
    if (!user) {
      user = await WIKI.db.users.query().findOne({
        email: primaryEmail,
        providerId: null,
        providerKey
      })
      if (user) {
        user = await user.$query().patchAndFetch({
          providerId: toString(profile.id)
        })
      }
    }

    // Parse display name
    let displayName = ''
    if (isString(profile.displayName) && profile.displayName.length > 0) {
      displayName = profile.displayName
    } else if (isString(profile.name) && profile.name.length > 0) {
      displayName = profile.name
    } else {
      displayName = primaryEmail.split('@')[0]
    }

    // Parse picture URL / Data
    let pictureUrl = ''
    if (profile.picture && Buffer.isBuffer(profile.picture)) {
      pictureUrl = 'internal'
    } else {
      pictureUrl = truncate(get(profile, 'picture', get(user, 'pictureUrl', null)), {
        length: 255,
        omission: ''
      })
    }

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

      if (pictureUrl === 'internal') {
        await WIKI.db.users.updateUserAvatarData(user.id, profile.picture)
      }

      return user
    }

    // Self-registration
    if (provider.selfRegistration) {
      // Check if email domain is whitelisted
      if (get(provider, 'domainWhitelist', []).length > 0) {
        const emailDomain = last(primaryEmail.split('@'))
        if (!provider.domainWhitelist.includes(emailDomain)) {
          throw new WIKI.Error.AuthRegistrationDomainUnauthorized()
        }
      }

      // Create account
      user = await WIKI.db.users.query().insertAndFetch({
        providerKey: providerKey,
        providerId: toString(profile.id),
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

      if (pictureUrl === 'internal') {
        await WIKI.db.users.updateUserAvatarData(user.id, profile.picture)
      }

      return user
    }

    throw new Error('You are not authorized to login.')
  }

  /**
   * Login a user
   */
  static async login (opts, context) {
    if (has(WIKI.auth.strategies, opts.strategy)) {
      const selStrategy = get(WIKI.auth.strategies, opts.strategy)
      if (!selStrategy.isEnabled) {
        throw new WIKI.Error.AuthProviderInvalid()
      }

      const strInfo = find(WIKI.data.authentication, ['key', selStrategy.module])

      // Inject form user/pass
      if (strInfo.useForm) {
        set(context.req, 'body.email', opts.username)
        set(context.req, 'body.password', opts.password)
        set(context.req.params, 'strategy', opts.strategy)
      }

      // Authenticate
      return new Promise((resolve, reject) => {
        WIKI.auth.passport.authenticate(selStrategy.id, {
          session: !strInfo.useForm,
          scope: strInfo.scopes ? strInfo.scopes : null
        }, async (err, user, info) => {
          if (err) { return reject(err) }
          if (!user) { return reject(new WIKI.Error.AuthLoginFailed()) }

          try {
            const resp = await WIKI.db.users.afterLoginChecks(user, selStrategy.id, context, {
              skipTFA: !strInfo.useForm,
              skipChangePwd: !strInfo.useForm
            })
            resolve(resp)
          } catch (err) {
            reject(err)
          }
        })(context.req, context.res, () => {})
      })
    } else {
      throw new WIKI.Error.AuthProviderInvalid()
    }
  }

  /**
   * Perform post-login checks
   */
  static async afterLoginChecks (user, strategyId, context, { skipTFA, skipChangePwd } = { skipTFA: false, skipChangePwd: false }) {
    // Get redirect target
    user.groups = await user.$relatedQuery('groups').select('groups.id', 'permissions', 'redirectOnLogin')
    let redirect = '/'
    if (user.groups && user.groups.length > 0) {
      for (const grp of user.groups) {
        if (!isEmpty(grp.redirectOnLogin) && grp.redirectOnLogin !== '/') {
          redirect = grp.redirectOnLogin
          break
        }
      }
    }

    // Get auth strategy flags
    const authStr = user.auth[strategyId] || {}

    // Is 2FA required?
    if (!skipTFA) {
      if (authStr.tfaRequired && authStr.tfaSecret) {
        try {
          const tfaToken = await WIKI.db.userKeys.generateToken({
            kind: 'tfa',
            userId: user.id
          })
          return {
            mustProvideTFA: true,
            continuationToken: tfaToken,
            redirect
          }
        } catch (errc) {
          WIKI.logger.warn(errc)
          throw new WIKI.Error.AuthGenericError()
        }
      } else if (WIKI.config.auth.enforce2FA || (authStr.tfaIsActive && !authStr.tfaSecret)) {
        try {
          const tfaQRImage = await user.generateTFA()
          const tfaToken = await WIKI.db.userKeys.generateToken({
            kind: 'tfaSetup',
            userId: user.id
          })
          return {
            mustSetupTFA: true,
            continuationToken: tfaToken,
            tfaQRImage,
            redirect
          }
        } catch (errc) {
          WIKI.logger.warn(errc)
          throw new WIKI.Error.AuthGenericError()
        }
      }
    }

    // Must Change Password?
    if (!skipChangePwd && authStr.mustChangePwd) {
      try {
        const pwdChangeToken = await WIKI.db.userKeys.generateToken({
          kind: 'changePwd',
          userId: user.id
        })

        return {
          mustChangePwd: true,
          continuationToken: pwdChangeToken,
          redirect
        }
      } catch (errc) {
        WIKI.logger.warn(errc)
        throw new WIKI.Error.AuthGenericError()
      }
    }

    return new Promise((resolve, reject) => {
      context.req.login(user, { session: false }, async errc => {
        if (errc) { return reject(errc) }
        const jwtToken = await WIKI.db.users.refreshToken(user, strategyId)
        resolve({ jwt: jwtToken.token, redirect })
      })
    })
  }

  /**
   * Generate a new token for a user
   */
  static async refreshToken(user, provider) {
    if (isString(user)) {
      user = await WIKI.db.users.query().findById(user).withGraphFetched('groups').modifyGraph('groups', builder => {
        builder.select('groups.id', 'permissions')
      })
      if (!user) {
        WIKI.logger.warn(`Failed to refresh token for user ${user}: Not found.`)
        throw new WIKI.Error.AuthGenericError()
      }
      if (!user.isActive) {
        WIKI.logger.warn(`Failed to refresh token for user ${user}: Inactive.`)
        throw new WIKI.Error.AuthAccountBanned()
      }
    } else if (isNil(user.groups)) {
      user.groups = await user.$relatedQuery('groups').select('groups.id', 'permissions')
    }

    // Update Last Login Date
    // -> Bypass Objection.js to avoid updating the updatedAt field
    await WIKI.db.knex('users').where('id', user.id).update({ lastLoginAt: new Date().toISOString() })

    return {
      token: jwt.sign({
        id: user.id,
        email: user.email,
        groups: user.getGroups(),
        ...provider && { pvd: provider }
      }, {
        key: WIKI.config.auth.certs.private,
        passphrase: WIKI.config.auth.secret
      }, {
        algorithm: 'RS256',
        expiresIn: WIKI.config.auth.tokenExpiration,
        audience: WIKI.config.auth.audience,
        issuer: 'urn:wiki.js'
      }),
      user
    }
  }

  /**
   * Verify a TFA login
   */
  static async loginTFA ({ securityCode, continuationToken, setup }, context) {
    if (securityCode.length === 6 && continuationToken.length > 1) {
      const user = await WIKI.db.userKeys.validateToken({
        kind: setup ? 'tfaSetup' : 'tfa',
        token: continuationToken,
        skipDelete: setup
      })
      if (user) {
        if (user.verifyTFA(securityCode)) {
          if (setup) {
            await user.enableTFA()
          }
          return WIKI.db.users.afterLoginChecks(user, context, { skipTFA: true })
        } else {
          throw new WIKI.Error.AuthTFAFailed()
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
    const usr = await WIKI.db.userKeys.validateToken({
      kind: 'changePwd',
      token: continuationToken
    })

    if (usr) {
      await WIKI.db.users.query().patch({
        password: newPassword,
        mustChangePwd: false
      }).findById(usr.id)

      return new Promise((resolve, reject) => {
        context.req.logIn(usr, { session: false }, async err => {
          if (err) { return reject(err) }
          const jwtToken = await WIKI.db.users.refreshToken(usr)
          resolve({ jwt: jwtToken.token })
        })
      })
    } else {
      throw new WIKI.Error.UserNotFound()
    }
  }

  /**
   * Send a password reset request
   */
  static async loginForgotPassword ({ email }, context) {
    const usr = await WIKI.db.users.query().where({
      email,
      providerKey: 'local'
    }).first()
    if (!usr) {
      WIKI.logger.debug(`Password reset attempt on nonexistant local account ${email}: [DISCARDED]`)
      return
    }
    const resetToken = await WIKI.db.userKeys.generateToken({
      userId: usr.id,
      kind: 'resetPwd'
    })

    await WIKI.mail.send({
      template: 'accountResetPwd',
      to: email,
      subject: `Password Reset Request`,
      data: {
        preheadertext: `A password reset was requested for ${WIKI.config.title}`,
        title: `A password reset was requested for ${WIKI.config.title}`,
        content: `Click the button below to reset your password. If you didn't request this password reset, simply discard this email.`,
        buttonLink: `${WIKI.config.host}/login-reset/${resetToken}`,
        buttonText: 'Reset Password'
      },
      text: `A password reset was requested for wiki ${WIKI.config.title}. Open the following link to proceed: ${WIKI.config.host}/login-reset/${resetToken}`
    })
  }

  /**
   * Create a new user
   *
   * @param {Object} param0 User Fields
   */
  static async createNewUser ({ email, password, name, groups, mustChangePassword = false, sendWelcomeEmail = false }) {
    // Input sanitization
    email = email.toLowerCase().trim()

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
      throw new Error(`ERR_INVALID_INPUT: ${validation[0]}`)
    }

    // Check if email already exists
    const usr = await WIKI.db.users.query().findOne({ email })
    if (usr) {
      throw new Error('ERR_ACCOUNT_ALREADY_EXIST')
    }

    // Create the account
    const localAuth = await WIKI.db.authentication.getStrategy('local')
    const newUsr = await WIKI.db.users.query().insert({
      email,
      name,
      auth: {
        [localAuth.id]: {
          password: await bcrypt.hash(password, 12),
          mustChangePwd: mustChangePassword,
          restrictLogin: false,
          tfaRequired: false,
          tfaSecret: ''
        }
      },
      localeCode: 'en',
      hasAvatar: false,
      isSystem: false,
      isActive: true,
      isVerified: true,
      meta: {
        jobTitle: '',
        location: '',
        pronouns: ''
      },
      prefs: {
        cvd: 'none',
        timezone: WIKI.config.userDefaults.timezone || 'America/New_York',
        appearance: 'site',
        dateFormat: WIKI.config.userDefaults.dateFormat || 'YYYY-MM-DD',
        timeFormat: WIKI.config.userDefaults.timeFormat || '12h'
      }
    })

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
  }

  /**
   * Update an existing user
   *
   * @param {Object} param0 User ID and fields to update
   */
  static async updateUser (id, { email, name, newPassword, groups, location, jobTitle, timezone, dateFormat, appearance }) {
    const usr = await WIKI.db.users.query().findById(id)
    if (usr) {
      let usrData = {}
      if (!isEmpty(email) && email !== usr.email) {
        const dupUsr = await WIKI.db.users.query().select('id').where({
          email,
          providerKey: usr.providerKey
        }).first()
        if (dupUsr) {
          throw new WIKI.Error.AuthAccountAlreadyExists()
        }
        usrData.email = email.toLowerCase()
      }
      if (!isEmpty(name) && name !== usr.name) {
        usrData.name = name.trim()
      }
      if (!isEmpty(newPassword)) {
        if (newPassword.length < 6) {
          throw new WIKI.Error.InputInvalid('Password must be at least 6 characters!')
        }
        usrData.password = newPassword
      }
      if (isArray(groups)) {
        const usrGroupsRaw = await usr.$relatedQuery('groups')
        const usrGroups = usrGroupsRaw.map(g => g.id)
        // Relate added groups
        const addUsrGroups = difference(groups, usrGroups)
        for (const grp of addUsrGroups) {
          await usr.$relatedQuery('groups').relate(grp)
        }
        // Unrelate removed groups
        const remUsrGroups = difference(usrGroups, groups)
        for (const grp of remUsrGroups) {
          await usr.$relatedQuery('groups').unrelate().where('groupId', grp)
        }
      }
      if (!isEmpty(location) && location !== usr.location) {
        usrData.location = location.trim()
      }
      if (!isEmpty(jobTitle) && jobTitle !== usr.jobTitle) {
        usrData.jobTitle = jobTitle.trim()
      }
      if (!isEmpty(timezone) && timezone !== usr.timezone) {
        usrData.timezone = timezone
      }
      if (!isNil(dateFormat) && dateFormat !== usr.dateFormat) {
        usrData.dateFormat = dateFormat
      }
      if (!isNil(appearance) && appearance !== usr.appearance) {
        usrData.appearance = appearance
      }
      await WIKI.db.users.query().patch(usrData).findById(id)
    } else {
      throw new WIKI.Error.UserNotFound()
    }
  }

  /**
   * Delete a User
   *
   * @param {*} id User ID
   */
  static async deleteUser (id, replaceId) {
    const usr = await WIKI.db.users.query().findById(id)
    if (usr) {
      await WIKI.db.assets.query().patch({ authorId: replaceId }).where('authorId', id)
      await WIKI.db.comments.query().patch({ authorId: replaceId }).where('authorId', id)
      await WIKI.db.pageHistory.query().patch({ authorId: replaceId }).where('authorId', id)
      await WIKI.db.pages.query().patch({ authorId: replaceId }).where('authorId', id)
      await WIKI.db.pages.query().patch({ creatorId: replaceId }).where('creatorId', id)

      await WIKI.db.userKeys.query().delete().where('userId', id)
      await WIKI.db.users.query().deleteById(id)
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
    const localStrg = await WIKI.db.authentication.getStrategy('local')
    // Check if self-registration is enabled
    if (localStrg.selfRegistration || bypassChecks) {
      // Input sanitization
      email = email.toLowerCase()

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
      if (get(localStrg, 'domainWhitelist.v', []).length > 0 && !bypassChecks) {
        const emailDomain = last(email.split('@'))
        if (!localStrg.domainWhitelist.v.includes(emailDomain)) {
          throw new WIKI.Error.AuthRegistrationDomainUnauthorized()
        }
      }
      // Check if email already exists
      const usr = await WIKI.db.users.query().findOne({ email, providerKey: 'local' })
      if (!usr) {
        // Create the account
        const newUsr = await WIKI.db.users.query().insert({
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
        if (get(localStrg, 'autoEnrollGroups.v', []).length > 0) {
          await newUsr.$relatedQuery('groups').relate(localStrg.autoEnrollGroups.v)
        }

        if (verify) {
          // Create verification token
          const verificationToken = await WIKI.db.userKeys.generateToken({
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

  /**
   * Logout the current user
   */
  static async logout (context) {
    if (!context.req.user || context.req.user.id === WIKI.config.auth.guestUserId) {
      return '/'
    }
    if (context.req.user.strategyId && has(WIKI.auth.strategies, context.req.user.strategyId)) {
      const selStrategy = WIKI.auth.strategies[context.req.user.strategyId]
      if (!selStrategy.isEnabled) {
        throw new WIKI.Error.AuthProviderInvalid()
      }
      const provider = find(WIKI.data.authentication, ['key', selStrategy.module])
      if (provider.logout) {
        return provider.logout(provider.config)
      }
    }
    return '/'
  }

  static async getGuestUser () {
    const user = await WIKI.db.users.query().findById(WIKI.config.auth.guestUserId).withGraphJoined('groups').modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions')
    })
    if (!user) {
      WIKI.logger.error('CRITICAL ERROR: Guest user is missing!')
      process.exit(1)
    }
    user.permissions = user.getPermissions()
    return user
  }

  static async getRootUser () {
    let user = await WIKI.db.users.query().findById(WIKI.config.auth.rootAdminUserId)
    if (!user) {
      WIKI.logger.error('CRITICAL ERROR: Root Administrator user is missing!')
      process.exit(1)
    }
    user.permissions = ['manage:system']
    return user
  }

  /**
   * Add / Update User Avatar Data
   */
  static async updateUserAvatarData (userId, data) {
    try {
      WIKI.logger.debug(`Updating user ${userId} avatar data...`)
      if (data.length > 1024 * 1024) {
        throw new Error('Avatar image filesize is too large. 1MB max.')
      }
      const existing = await WIKI.db.knex('userAvatars').select('id').where('id', userId).first()
      if (existing) {
        await WIKI.db.knex('userAvatars').where({
          id: userId
        }).update({
          data
        })
      } else {
        await WIKI.db.knex('userAvatars').insert({
          id: userId,
          data
        })
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to process binary thumbnail data for user ${userId}: ${err.message}`)
    }
  }

  static async getUserAvatarData (userId) {
    try {
      const usrData = await WIKI.db.knex('userAvatars').where('id', userId).first()
      if (usrData) {
        return usrData.data
      } else {
        return null
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to process binary thumbnail data for user ${userId}`)
    }
  }
}
