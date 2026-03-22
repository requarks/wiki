import bcrypt from 'bcryptjs'
import { userGroups, users as usersTable, userKeys } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { DateTime } from 'luxon'
import { flatten, uniq } from 'es-toolkit/array'

/**
 * Users model
 */
class Users {
  async getByEmail(email) {
    const res = await WIKI.db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1)
    return res?.[0] ?? null
  }
  async init(ids) {
    WIKI.logger.info('Inserting default users...')

    await WIKI.db.insert(usersTable).values([
      {
        id: ids.userAdminId,
        email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
        auth: {
          [ids.authModuleId]: {
            password: await bcrypt.hash(process.env.ADMIN_PASS || '12345678', 12),
            mustChangePwd: !process.env.ADMIN_PASS,
            restrictLogin: false,
            tfaIsActive: false,
            tfaRequired: false,
            tfaSecret: ''
          }
        },
        name: 'Administrator',
        isSystem: false,
        isActive: true,
        isVerified: true,
        meta: {
          location: '',
          jobTitle: '',
          pronouns: ''
        },
        prefs: {
          timezone: 'America/New_York',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '12h',
          appearance: 'site',
          cvd: 'none'
        }
      },
      {
        id: ids.userGuestId,
        email: 'guest@example.com',
        auth: {},
        name: 'Guest',
        isSystem: true,
        isActive: true,
        isVerified: true,
        meta: {},
        prefs: {
          timezone: 'America/New_York',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '12h',
          appearance: 'site',
          cvd: 'none'
        }
      }
    ])

    await WIKI.db.insert(userGroups).values([
      {
        userId: ids.userAdminId,
        groupId: ids.groupAdminId
      },
      {
        userId: ids.userGuestId,
        groupId: ids.groupGuestId
      }
    ])
  }

  async login({ siteId, strategyId, username, password, ip }, req) {
    if (strategyId in WIKI.auth.strategies) {
      const str = WIKI.auth.strategies[strategyId]
      const strInfo = WIKI.data.authentication.find((a) => a.key === str.module)
      const context = {
        ip,
        siteId,
        ...(strInfo.useForm && {
          username,
          password
        })
      }

      // Authenticate
      const user = await str.authenticate(context)

      // Perform post-login checks
      return this.afterLoginChecks(
        user,
        strategyId,
        context,
        {
          skipTFA: !strInfo.useForm,
          skipChangePwd: !strInfo.useForm
        },
        req
      )
    } else {
      throw new Error('Invalid Strategy ID')
    }
  }

  async afterLoginChecks(
    user,
    strategyId,
    context,
    { skipTFA, skipChangePwd } = { skipTFA: false, skipChangePwd: false },
    req
  ) {
    const str = WIKI.auth.strategies[strategyId]
    if (!str) {
      throw new Error('ERR_INVALID_STRATEGY')
    }

    // Get user groups
    user.groups = await WIKI.db.query.users
      .findFirst({
        columns: {},
        where: {
          id: user.id
        },
        with: {
          groups: {
            columns: {
              id: true,
              permissions: true,
              redirectOnLogin: true
            }
          }
        }
      })
      .then((r) => r?.groups || [])

    // Get redirect target
    let redirect = '/'
    if (user.groups && user.groups.length > 0) {
      for (const grp of user.groups) {
        if (grp.redirectOnLogin && grp.redirectOnLogin !== '/') {
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
          const tfaQRImage = await user.generateTFA(strategyId, context.siteId)
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
        const pwdChangeToken = await this.generateToken({
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

    // Set Session Data
    this.updateSession(user, req)

    return {
      authenticated: true,
      nextAction: 'redirect',
      redirect
    }
  }

  async loginChangePassword({ strategyId, siteId, continuationToken, newPassword, ip }, req) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('ERR_PASSWORD_TOO_SHORT')
    }
    const { user, strategyId: expectedStrategyId } = await this.validateToken({
      kind: 'changePwd',
      token: continuationToken
    })

    if (strategyId !== expectedStrategyId) {
      throw new Error('ERR_INVALID_STRATEGY')
    }

    if (user) {
      user.auth[strategyId].password = await bcrypt.hash(newPassword, 12)
      user.auth[strategyId].mustChangePwd = false
      await WIKI.db.update(usersTable).set({ auth: user.auth }).where(eq(usersTable.id, user.id))

      return this.afterLoginChecks(
        user,
        strategyId,
        { ip, siteId },
        { skipChangePwd: true, skipTFA: true },
        req
      )
    } else {
      throw new Error('ERR_INVALID_USER')
    }
  }

  updateSession(user, req) {
    req.session.authenticated = true
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      hasAvatar: user.hasAvatar,
      timezone: user.prefs?.timezone,
      dateFormat: user.prefs?.dateFormat,
      timeFormat: user.prefs?.timeFormat,
      appearance: user.prefs?.appearance,
      cvd: user.prefs?.cvd
    }
    req.session.permissions = uniq(flatten(user.groups?.map((g) => g.permissions)))
  }

  async generateToken({ userId, kind, meta = {} }) {
    WIKI.logger.debug(`Generating ${kind} token for user ${userId}...`)
    const token = await nanoid()
    await WIKI.db.insert(userKeys).values({
      kind,
      token,
      meta,
      validUntil: DateTime.utc().plus({ days: 1 }).toISO(),
      userId
    })
    return token
  }

  async validateToken({ kind, token, skipDelete }) {
    const res = await WIKI.db.query.userKeys.findFirst({
      where: {
        kind,
        token
      },
      with: {
        user: true
      }
    })
    if (res) {
      if (skipDelete !== true) {
        await WIKI.db.delete(userKeys).where(eq(userKeys.id, res.id))
      }
      if (DateTime.utc() > DateTime.fromISO(res.validUntil)) {
        throw new Error('ERR_EXPIRED_VALIDATION_TOKEN')
      }
      return {
        ...res.meta,
        user: res.user
      }
    } else {
      throw new Error('ERR_INVALID_VALIDATION_TOKEN')
    }
  }

  async destroyToken({ token }) {
    return WIKI.db.delete(userKeys).where(eq(userKeys.token, token))
  }
}

export const users = new Users()
