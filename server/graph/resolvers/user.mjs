import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import _ from 'lodash-es'
import path from 'node:path'
import fs from 'fs-extra'

export default {
  Query: {
    /**
     * FETCH ALL USERS
     */
    async users (obj, args, context, info) {
      // -> Sanitize limit
      let limit = args.pageSize ?? 20
      if (limit < 1 || limit > 1000) {
        limit = 1000
      }

      // -> Sanitize offset
      let offset = args.page ?? 1
      if (offset < 1) {
        offset = 1
      }

      // -> Fetch Users
      return WIKI.db.users.query()
        .select('id', 'email', 'name', 'isSystem', 'isActive', 'createdAt', 'lastLoginAt')
        .where(builder => {
          if (args.filter) {
            builder.where('email', 'like', `%${args.filter}%`)
              .orWhere('name', 'like', `%${args.filter}%`)
          }
        })
        .orderBy(args.orderBy ?? 'name', args.orderByDirection ?? 'asc')
        .offset((offset - 1) * limit)
        .limit(limit)
    },
    /**
     * FETCH A SINGLE USER
     */
    async userById (obj, args, context, info) {
      const usr = await WIKI.db.users.query().findById(args.id)

      if (!usr) {
        throw new Error('Invalid User')
      }

      // const str = _.get(WIKI.auth.strategies, usr.providerKey)
      // str.strategy = _.find(WIKI.data.authentication, ['key', str.strategyKey])
      // usr.providerName = str.displayName
      // usr.providerIs2FACapable = _.get(str, 'strategy.useForm', false)

      usr.auth = _.mapValues(usr.auth, (auth, providerKey) => {
        if (auth.password) {
          auth.password = '***'
        }
        auth.module = providerKey === '00910749-8ab6-498a-9be0-f4ca28ea5e52' ? 'google' : 'local'
        auth._moduleName = providerKey === '00910749-8ab6-498a-9be0-f4ca28ea5e52' ? 'Google' : 'Local'
        return auth
      })

      return usr
    },
    // async profile (obj, args, context, info) {
    //   if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
    //     throw new WIKI.Error.AuthRequired()
    //   }
    //   const usr = await WIKI.db.users.query().findById(context.req.user.id)
    //   if (!usr.isActive) {
    //     throw new WIKI.Error.AuthAccountBanned()
    //   }

    //   const providerInfo = _.get(WIKI.auth.strategies, usr.providerKey, {})

    //   usr.providerName = providerInfo.displayName || 'Unknown'
    //   usr.lastLoginAt = usr.lastLoginAt || usr.updatedAt
    //   usr.password = ''
    //   usr.providerId = ''
    //   usr.tfaSecret = ''

    //   return usr
    // },
    async lastLogins (obj, args, context, info) {
      return WIKI.db.users.query()
        .select('id', 'name', 'lastLoginAt')
        .whereNotNull('lastLoginAt')
        .orderBy('lastLoginAt', 'desc')
        .limit(10)
    },

    async userPermissions (obj, args, context) {
      if (!context.req.user || context.req.user.id === WIKI.auth.guest.id) {
        throw new WIKI.Error.AuthRequired()
      }

      const currentUser = await WIKI.db.users.getById(context.req.user.id)
      return currentUser.getPermissions()
    },
    async userPermissionsAtPath (obj, args, context) {
      return []
    }
  },
  Mutation: {
    async createUser (obj, args) {
      try {
        await WIKI.db.users.createNewUser({ ...args, isVerified: true })

        return {
          operation: generateSuccess('User created successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async deleteUser (obj, args) {
      try {
        if (args.id <= 2) {
          throw new WIKI.Error.UserDeleteProtected()
        }
        await WIKI.db.users.deleteUser(args.id, args.replaceId)

        WIKI.auth.revokeUserTokens({ id: args.id, kind: 'u' })
        WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'u' })

        return {
          operation: generateSuccess('User deleted successfully')
        }
      } catch (err) {
        if (err.message.indexOf('foreign') >= 0) {
          return generateError(new WIKI.Error.UserDeleteForeignConstraint())
        } else {
          return generateError(err)
        }
      }
    },
    async updateUser (obj, args) {
      try {
        console.info(args.id)
        await WIKI.db.users.updateUser(args.id, args.patch)

        return {
          operation: generateSuccess('User updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async verifyUser (obj, args) {
      try {
        await WIKI.db.users.query().patch({ isVerified: true }).findById(args.id)

        return {
          operation: generateSuccess('User verified successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async activateUser (obj, args) {
      try {
        await WIKI.db.users.query().patch({ isActive: true }).findById(args.id)

        return {
          operation: generateSuccess('User activated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async deactivateUser (obj, args) {
      try {
        if (args.id <= 2) {
          throw new Error('Cannot deactivate system accounts.')
        }
        await WIKI.db.users.query().patch({ isActive: false }).findById(args.id)

        WIKI.auth.revokeUserTokens({ id: args.id, kind: 'u' })
        WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'u' })

        return {
          operation: generateSuccess('User deactivated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async enableUserTFA (obj, args) {
      try {
        await WIKI.db.users.query().patch({ tfaIsActive: true, tfaSecret: null }).findById(args.id)

        return {
          operation: generateSuccess('User 2FA enabled successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async disableUserTFA (obj, args) {
      try {
        await WIKI.db.users.query().patch({ tfaIsActive: false, tfaSecret: null }).findById(args.id)

        return {
          operation: generateSuccess('User 2FA disabled successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    resetUserPassword (obj, args) {
      return false
    },
    async updateProfile (obj, args, context) {
      try {
        if (!context.req.user || context.req.user.id === WIKI.auth.guest.id) {
          throw new WIKI.Error.AuthRequired()
        }
        const usr = await WIKI.db.users.query().findById(context.req.user.id)
        if (!usr.isActive) {
          throw new WIKI.Error.AuthAccountBanned()
        }
        if (!usr.isVerified) {
          throw new WIKI.Error.AuthAccountNotVerified()
        }

        if (args.dateFormat && !['', 'DD/MM/YYYY', 'DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD'].includes(args.dateFormat)) {
          throw new WIKI.Error.InputInvalid()
        }

        if (args.appearance && !['site', 'light', 'dark'].includes(args.appearance)) {
          throw new WIKI.Error.InputInvalid()
        }

        await WIKI.db.users.query().findById(usr.id).patch({
          name: args.name?.trim() ?? usr.name,
          meta: {
            ...usr.meta,
            location: args.location?.trim() ?? usr.meta.location,
            jobTitle: args.jobTitle?.trim() ?? usr.meta.jobTitle,
            pronouns: args.pronouns?.trim() ?? usr.meta.pronouns
          },
          prefs: {
            ...usr.prefs,
            timezone: args.timezone || usr.prefs.timezone,
            dateFormat: args.dateFormat ?? usr.prefs.dateFormat,
            timeFormat: args.timeFormat ?? usr.prefs.timeFormat,
            appearance: args.appearance || usr.prefs.appearance,
            cvd: args.cvd || usr.prefs.cvd
          }
        })

        return {
          operation: generateSuccess('User profile updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async changePassword (obj, args, context) {
      try {
        if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
          throw new WIKI.Error.AuthRequired()
        }
        const usr = await WIKI.db.users.query().findById(context.req.user.id)
        if (!usr.isActive) {
          throw new WIKI.Error.AuthAccountBanned()
        }
        if (!usr.isVerified) {
          throw new WIKI.Error.AuthAccountNotVerified()
        }
        if (usr.providerKey !== 'local') {
          throw new WIKI.Error.AuthProviderInvalid()
        }
        try {
          await usr.verifyPassword(args.current)
        } catch (err) {
          throw new WIKI.Error.AuthPasswordInvalid()
        }

        await WIKI.db.users.updateUser({
          id: usr.id,
          newPassword: args.new
        })

        const newToken = await WIKI.db.users.refreshToken(usr)

        return {
          responseResult: generateSuccess('Password changed successfully'),
          jwt: newToken.token
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * UPLOAD USER AVATAR
     */
    async uploadUserAvatar (obj, args) {
      try {
        const { filename, mimetype, createReadStream } = await args.image
        const lowercaseFilename = filename.toLowerCase()
        WIKI.logger.debug(`Processing user ${args.id} avatar ${lowercaseFilename} of type ${mimetype}...`)
        if (!WIKI.extensions.ext.sharp.isInstalled) {
          throw new Error('This feature requires the Sharp extension but it is not installed. Contact your wiki administrator.')
        }
        if (!['.png', '.jpg', '.webp', '.gif'].some(s => lowercaseFilename.endsWith(s))) {
          throw new Error('Invalid File Extension. Must be png, jpg, webp or gif.')
        }
        const destFolder = path.resolve(
          process.cwd(),
          WIKI.config.dataPath,
          `assets`
        )
        const destPath = path.join(destFolder, `userav-${args.id}.jpg`)
        await fs.ensureDir(destFolder)
        // -> Resize
        await WIKI.extensions.ext.sharp.resize({
          format: 'jpg',
          inputStream: createReadStream(),
          outputPath: destPath,
          width: 180,
          height: 180
        })
        // -> Set avatar flag for this user in the DB
        await WIKI.db.users.query().findById(args.id).patch({ hasAvatar: true })
        // -> Save image data to DB
        const imgBuffer = await fs.readFile(destPath)
        await WIKI.db.knex('userAvatars').insert({
          id: args.id,
          data: imgBuffer
        }).onConflict('id').merge()
        WIKI.logger.debug(`Processed user ${args.id} avatar successfully.`)
        return {
          operation: generateSuccess('User avatar uploaded successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    },
    /**
     * CLEAR USER AVATAR
     */
    async clearUserAvatar (obj, args) {
      try {
        WIKI.logger.debug(`Clearing user ${args.id} avatar...`)
        await WIKI.db.users.query().findById(args.id).patch({ hasAvatar: false })
        await WIKI.db.knex('userAvatars').where({ id: args.id }).del()
        WIKI.logger.debug(`Cleared user ${args.id} avatar successfully.`)
        return {
          operation: generateSuccess('User avatar cleared successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    }
  },
  User: {
    async auth (usr) {
      const authStrategies = await WIKI.db.authentication.getStrategies({ enabledOnly: true })
      return _.transform(usr.auth, (result, value, key) => {
        const authStrategy = _.find(authStrategies, ['id', key])
        const authModule = _.find(WIKI.data.authentication, ['key', authStrategy.module])
        if (!authStrategy || !authModule) { return }
        result.push({
          authId: key,
          authName: authStrategy.displayName,
          strategyKey: authStrategy.module,
          strategyIcon: authModule.icon,
          config: authStrategy.module === 'local' ? {
            isPasswordSet: value.password?.length > 0,
            isTfaSetup: value.tfaSecret?.length > 0,
            isTfaRequired: value.tfaRequired ?? false,
            mustChangePwd: value.mustChangePwd ?? false,
            restrictLogin: value.restrictLogin ?? false
          } : value
        })
      }, [])
    },
    groups (usr) {
      return usr.$relatedQuery('groups')
    }
  }
  // UserProfile: {
  //   async groups (usr) {
  //     const usrGroups = await usr.$relatedQuery('groups')
  //     return usrGroups.map(g => g.name)
  //   },
  //   async pagesTotal (usr) {
  //     const result = await WIKI.db.pages.query().count('* as total').where('creatorId', usr.id).first()
  //     return _.toSafeInteger(result.total)
  //   }
  // }
}
