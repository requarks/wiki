/* global WIKI */

import { difference, find, first, flatten, flattenDeep, get, has, isArray, isEmpty, isNil, isString, last, set, toString, truncate, uniq } from 'lodash-es'
import tfa from 'node-2fa'
import jwt from 'jsonwebtoken'
import { Model } from 'objection'
import validate from 'validate.js'
import qr from 'qr-image'
import bcrypt from 'bcryptjs'

import { Group } from './groups.mjs'

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

  async generateTFA(strategyId, siteId) {
    WIKI.logger.debug(`Generating new TFA secret for user ${this.id}...`)
    const site = WIKI.sites[siteId] ?? WIKI.sites[0] ?? { config: { title: 'Wiki' } }
    const tfaInfo = tfa.generateSecret({
      name: site.config.title,
      account: this.email
    })
    this.auth[strategyId].tfaSecret = tfaInfo.secret
    this.auth[strategyId].tfaIsActive = false
    await this.$query().patch({
      auth: this.auth
    })
    const safeTitle = site.config.title.replace(/[\s-.,=!@#$%?&*()+[\]{}/\\;<>]/g, '')
    return qr.imageSync(`otpauth://totp/${safeTitle}:${this.email}?secret=${tfaInfo.secret}`, { type: 'svg' })
  }

  async enableTFA(strategyId) {
    this.auth[strategyId].tfaIsActive = true
    return this.$query().patch({
      auth: this.auth
    })
  }

  async disableTFA(strategyId) {
    this.auth[strategyId].tfaIsActive = false
    return this.$query().patch({
      tfaIsActive: false,
      tfaSecret: ''
    })
  }

  verifyTFA(strategyId, code) {
    return tfa.verifyToken(this.auth[strategyId].tfaSecret, code)?.delta === 0
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
        locale: WIKI.config.lang.code,
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
  static async login ({ strategyId, siteId, username, password }, context) {
    if (has(WIKI.auth.strategies, strategyId)) {
      const selStrategy = WIKI.auth.strategies[strategyId]
      if (!selStrategy.isEnabled) {
        throw new WIKI.Error.AuthProviderInvalid()
      }

      const strInfo = find(WIKI.data.authentication, ['key', selStrategy.module])

      // Inject form user/pass
      if (strInfo.useForm) {
        set(context.req, 'body.email', username)
        set(context.req, 'body.password', password)
        set(context.req.params, 'strategy', strategyId)
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
              siteId,
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
  static async afterLoginChecks (user, strategyId, context, { siteId, skipTFA, skipChangePwd } = { skipTFA: false, skipChangePwd: false, siteId: null }) {
    const str = WIKI.auth.strategies[strategyId]
    if (!str) {
      throw new Error('ERR_INVALID_STRATEGY')
    }

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
      if (authStr.tfaIsActive && authStr.tfaSecret) {
        try {
          const tfaToken = await WIKI.db.userKeys.generateToken({
            kind: 'tfa',
            userId: user.id,
            meta: {
              strategyId
            }
          })
          return {
            nextAction: 'provideTfa',
            continuationToken: tfaToken,
            redirect
          }
        } catch (errc) {
          WIKI.logger.warn(errc)
          throw new WIKI.Error.AuthGenericError()
        }
      } else if (str.config?.enforceTfa || authStr.tfaRequired) {
        try {
          const tfaQRImage = await user.generateTFA(strategyId, siteId)
          const tfaToken = await WIKI.db.userKeys.generateToken({
            kind: 'tfaSetup',
            userId: user.id,
            meta: {
              strategyId
            }
          })
          return {
            nextAction: 'setupTfa',
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
          userId: user.id,
          meta: {
            strategyId
          }
        })

        return {
          nextAction: 'changePassword',
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
        resolve({
          nextAction: 'redirect',
          jwt: jwtToken.token,
          redirect
        })
      })
    })
  }

  /**
   * Generate a new token for a user
   */
  static async refreshToken (user) {
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
        groups: user.getGroups()
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
  static async loginTFA ({ strategyId, siteId, securityCode, continuationToken, setup }, context) {
    if (securityCode.length === 6 && continuationToken.length > 1) {
      const { user, strategyId: expectedStrategyId } = await WIKI.db.userKeys.validateToken({
        kind: setup ? 'tfaSetup' : 'tfa',
        token: continuationToken,
        skipDelete: setup
      })

      if (strategyId !== expectedStrategyId) {
        throw new Error('ERR_UNEXPECTED_STRATEGY_ID')
      }

      if (user) {
        if (user.verifyTFA(strategyId, securityCode)) {
          if (setup) {
            await user.enableTFA(strategyId)
          }
          return WIKI.db.users.afterLoginChecks(user, strategyId, context, { siteId, skipTFA: true })
        } else {
          throw new Error('ERR_INCORRECT_TFA_TOKEN')
        }
      }
    }
    throw new Error('ERR_INVALID_TFA_REQUEST')
  }

  /**
   * Change Password from a Mandatory Password Change after Login
   */
  static async loginChangePassword ({ strategyId, siteId, continuationToken, newPassword }, context) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('ERR_PASSWORD_TOO_SHORT')
    }
    const { user, strategyId: expectedStrategyId } = await WIKI.db.userKeys.validateToken({
      kind: 'changePwd',
      token: continuationToken
    })

    if (strategyId !== expectedStrategyId) {
      throw new Error('ERR_UNEXPECTED_STRATEGY_ID')
    }

    if (user) {
      user.auth[strategyId].password = await bcrypt.hash(newPassword, 12)
      user.auth[strategyId].mustChangePwd = false
      await user.$query().patch({
        auth: user.auth
      })

      return WIKI.db.users.afterLoginChecks(user, strategyId, context, { siteId, skipChangePwd: true, skipTFA: true })
    } else {
      throw new Error('ERR_INVALID_USER')
    }
  }

  /**
   * Change Password from Profile
   */
  static async changePassword ({ strategyId, siteId, currentPassword, newPassword }, context) {
    const userId = context.req.user?.id
    if (!userId) {
      throw new Error('ERR_USER_NOT_AUTHENTICATED')
    }

    const user = await WIKI.db.users.query().findById(userId)
    if (!user) {
      throw new Error('ERR_USER_NOT_FOUND')
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('ERR_PASSWORD_TOO_SHORT')
    }

    if (!user.auth[strategyId]?.password) {
      throw new Error('ERR_UNEXPECTED_STRATEGY_ID')
    }

    if (await bcrypt.compare(currentPassword, user.auth[strategyId].password) !== true) {
      throw new Error('ERR_INCORRECT_CURRENT_PASSWORD')
    }

    user.auth[strategyId].password = await bcrypt.hash(newPassword, 12)
    user.auth[strategyId].mustChangePwd = false

    await user.$query().patch({
      auth: user.auth
    })

    return true
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
  static async createNewUser ({ email, password, name, groups, userInitiated = false, mustChangePassword = false, sendWelcomeEmail = false }) {
    const localAuth = await WIKI.db.authentication.getStrategy('local')

    // Check if self-registration is enabled
    if (userInitiated && !localAuth.registration) {
      throw new Error('ERR_REGISTRATION_DISABLED')
    }

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

    // Check if email address is allowed
    if (userInitiated && localAuth.allowedEmailRegex) {
      const emailCheckRgx = new RegExp(localAuth.allowedEmailRegex, 'i')
      if (!emailCheckRgx.test(email)) {
        throw new Error('ERR_EMAIL_ADDRESS_NOT_ALLOWED')
      }
    }

    // Check if email already exists
    const usr = await WIKI.db.users.query().findOne({ email })
    if (usr) {
      throw new Error('ERR_ACCOUNT_ALREADY_EXIST')
    }

    WIKI.logger.debug(`Creating new user account for ${email}...`)

    // Create the account
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
        timeFormat: WIKI.config.userDefaults.timeFormat || '12h'
      }
    }).returning('*')

    // Assign to group(s)
    const groupsToEnroll = [WIKI.data.systemIds.usersGroupId]
    if (groups?.length > 0) {
      groupsToEnroll.push(...groups)
    }
    if (userInitiated && localAuth.autoEnrollGroups?.length > 0) {
      groupsToEnroll.push(...localAuth.autoEnrollGroups)
    }
    await newUsr.$relatedQuery('groups').relate(uniq(groupsToEnroll))

    // Verification Email
    if (userInitiated && localAuth.config?.emailValidation) {
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
    } else if (sendWelcomeEmail) {
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

    WIKI.logger.debug(`Created new user account for ${email} successfully.`)

    return newUsr
  }

  /**
   * Update an existing user
   *
   * @param {Object} param0 User ID and fields to update
   */
  static async updateUser (id, { email, name, groups, auth, isVerified, isActive, meta, prefs }) {
    const usr = await WIKI.db.users.query().findById(id)
    if (usr) {
      let usrData = {}
      if (!isEmpty(email) && email !== usr.email) {
        const dupUsr = await WIKI.db.users.query().select('id').where({ email }).first()
        if (dupUsr) {
          throw new Error('ERR_DUPLICATE_ACCOUNT_EMAIL')
        }
        usrData.email = email.toLowerCase()
      }
      if (!isEmpty(name) && name !== usr.name) {
        usrData.name = name.trim()
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
      if (!isNil(auth?.tfaRequired)) {
        usr.auth[WIKI.data.systemIds.localAuthId].tfaRequired = auth.tfaRequired
        usrData.auth = usr.auth
      }
      if (!isNil(auth?.mustChangePwd)) {
        usr.auth[WIKI.data.systemIds.localAuthId].mustChangePwd = auth.mustChangePwd
        usrData.auth = usr.auth
      }
      if (!isNil(auth?.restrictLogin)) {
        usr.auth[WIKI.data.systemIds.localAuthId].restrictLogin = auth.restrictLogin
        usrData.auth = usr.auth
      }
      if (!isNil(isVerified)) {
        usrData.isVerified = isVerified
      }
      if (!isNil(isActive)) {
        usrData.isVerified = isActive
      }
      if (!isEmpty(meta)) {
        usrData.meta = meta
      }
      if (!isEmpty(prefs)) {
        usrData.prefs = prefs
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
