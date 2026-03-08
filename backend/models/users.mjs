/* global WIKI */

import bcrypt from 'bcryptjs'
import { userGroups as userGroupsTable, users as usersTable } from '../db/schema.mjs'

/**
 * Users model
 */
class Users {
  async init (ids) {
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

    await WIKI.db.insert(userGroupsTable).values([
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

  async login ({ siteId, strategyId, username, password, ip }) {
    if (strategyId in WIKI.auth.strategies) {
      const selStrategy = WIKI.auth.strategies[strategyId]
      if (!selStrategy.isEnabled) {
        throw new Error('Inactive Strategy ID')
      }

      const strInfo = WIKI.data.authentication.find(a => a.key === selStrategy.module)

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
      throw new Error('Invalid Strategy ID')
    }
  }
}

export const users = new Users()
