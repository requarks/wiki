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
}

export const users = new Users()
