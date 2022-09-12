const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
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
      return WIKI.models.users.query()
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
      const usr = await WIKI.models.users.query().findById(args.id)

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
    //   const usr = await WIKI.models.users.query().findById(context.req.user.id)
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
      return WIKI.models.users.query()
        .select('id', 'name', 'lastLoginAt')
        .whereNotNull('lastLoginAt')
        .orderBy('lastLoginAt', 'desc')
        .limit(10)
    }
  },
  Mutation: {
    async createUser (obj, args) {
      try {
        await WIKI.models.users.createNewUser({ ...args, passwordRaw: args.password, isVerified: true })

        return {
          operation: graphHelper.generateSuccess('User created successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deleteUser (obj, args) {
      try {
        if (args.id <= 2) {
          throw new WIKI.Error.UserDeleteProtected()
        }
        await WIKI.models.users.deleteUser(args.id, args.replaceId)

        WIKI.auth.revokeUserTokens({ id: args.id, kind: 'u' })
        WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'u' })

        return {
          operation: graphHelper.generateSuccess('User deleted successfully')
        }
      } catch (err) {
        if (err.message.indexOf('foreign') >= 0) {
          return graphHelper.generateError(new WIKI.Error.UserDeleteForeignConstraint())
        } else {
          return graphHelper.generateError(err)
        }
      }
    },
    async updateUser (obj, args) {
      try {
        await WIKI.models.users.updateUser(args.id, args.patch)

        return {
          operation: graphHelper.generateSuccess('User updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async verifyUser (obj, args) {
      try {
        await WIKI.models.users.query().patch({ isVerified: true }).findById(args.id)

        return {
          operation: graphHelper.generateSuccess('User verified successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async activateUser (obj, args) {
      try {
        await WIKI.models.users.query().patch({ isActive: true }).findById(args.id)

        return {
          operation: graphHelper.generateSuccess('User activated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deactivateUser (obj, args) {
      try {
        if (args.id <= 2) {
          throw new Error('Cannot deactivate system accounts.')
        }
        await WIKI.models.users.query().patch({ isActive: false }).findById(args.id)

        WIKI.auth.revokeUserTokens({ id: args.id, kind: 'u' })
        WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'u' })

        return {
          operation: graphHelper.generateSuccess('User deactivated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async enableUserTFA (obj, args) {
      try {
        await WIKI.models.users.query().patch({ tfaIsActive: true, tfaSecret: null }).findById(args.id)

        return {
          operation: graphHelper.generateSuccess('User 2FA enabled successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async disableUserTFA (obj, args) {
      try {
        await WIKI.models.users.query().patch({ tfaIsActive: false, tfaSecret: null }).findById(args.id)

        return {
          operation: graphHelper.generateSuccess('User 2FA disabled successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
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
        const usr = await WIKI.models.users.query().findById(context.req.user.id)
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

        await WIKI.models.users.query().findById(usr.id).patch({
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
            appearance: args.appearance || usr.prefs.appearance
          }
        })

        return {
          operation: graphHelper.generateSuccess('User profile updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async changePassword (obj, args, context) {
      try {
        if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
          throw new WIKI.Error.AuthRequired()
        }
        const usr = await WIKI.models.users.query().findById(context.req.user.id)
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

        await WIKI.models.users.updateUser({
          id: usr.id,
          newPassword: args.new
        })

        const newToken = await WIKI.models.users.refreshToken(usr)

        return {
          responseResult: graphHelper.generateSuccess('Password changed successfully'),
          jwt: newToken.token
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  User: {
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
  //     const result = await WIKI.models.pages.query().count('* as total').where('creatorId', usr.id).first()
  //     return _.toSafeInteger(result.total)
  //   }
  // }
}
