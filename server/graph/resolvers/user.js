const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async users() { return {} }
  },
  Mutation: {
    async users() { return {} }
  },
  UserQuery: {
    async list(obj, args, context, info) {
      return WIKI.models.users.query()
        .select('id', 'email', 'name', 'providerKey', 'isSystem', 'isActive', 'createdAt', 'lastLoginAt')
    },
    async search(obj, args, context, info) {
      return WIKI.models.users.query()
        .where('email', 'like', `%${args.query}%`)
        .orWhere('name', 'like', `%${args.query}%`)
        .limit(10)
        .select('id', 'email', 'name', 'providerKey', 'createdAt')
    },
    async single(obj, args, context, info) {
      let usr = await WIKI.models.users.query().findById(args.id)
      usr.password = ''
      usr.tfaSecret = ''

      const str = _.get(WIKI.auth.strategies, usr.providerKey)
      str.strategy = _.find(WIKI.data.authentication, ['key', str.strategyKey])
      usr.providerName = str.displayName
      usr.providerIs2FACapable = _.get(str, 'strategy.useForm', false)

      return usr
    },
    async profile (obj, args, context, info) {
      if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
        throw new WIKI.Error.AuthRequired()
      }
      const usr = await WIKI.models.users.query().findById(context.req.user.id)
      if (!usr.isActive) {
        throw new WIKI.Error.AuthAccountBanned()
      }

      const providerInfo = _.get(WIKI.auth.strategies, usr.providerKey, {})

      usr.providerName = providerInfo.displayName || 'Unknown'
      usr.lastLoginAt = usr.lastLoginAt || usr.updatedAt
      usr.password = ''
      usr.providerId = ''
      usr.tfaSecret = ''

      return usr
    },
    async lastLogins (obj, args, context, info) {
      return WIKI.models.users.query()
        .select('id', 'name', 'lastLoginAt')
        .whereNotNull('lastLoginAt')
        .orderBy('lastLoginAt', 'desc')
        .limit(10)
    }
  },
  UserMutation: {
    async create (obj, args) {
      try {
        await WIKI.models.users.createNewUser(args)

        return {
          responseResult: graphHelper.generateSuccess('User created successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async delete (obj, args) {
      try {
        if (args.id <= 2) {
          throw new WIKI.Error.UserDeleteProtected()
        }
        await WIKI.models.users.deleteUser(args.id, args.replaceId)

        WIKI.auth.revokeUserTokens({ id: args.id, kind: 'u' })
        WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'u' })

        return {
          responseResult: graphHelper.generateSuccess('User deleted successfully')
        }
      } catch (err) {
        if (err.message.indexOf('foreign') >= 0) {
          return graphHelper.generateError(new WIKI.Error.UserDeleteForeignConstraint())
        } else {
          return graphHelper.generateError(err)
        }
      }
    },
    async update (obj, args) {
      try {
        await WIKI.models.users.updateUser(args)

        return {
          responseResult: graphHelper.generateSuccess('User created successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async verify (obj, args) {
      try {
        await WIKI.models.users.query().patch({ isVerified: true }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User verified successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async activate (obj, args) {
      try {
        await WIKI.models.users.query().patch({ isActive: true }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User activated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deactivate (obj, args) {
      try {
        if (args.id <= 2) {
          throw new Error('Cannot deactivate system accounts.')
        }
        await WIKI.models.users.query().patch({ isActive: false }).findById(args.id)

        WIKI.auth.revokeUserTokens({ id: args.id, kind: 'u' })
        WIKI.events.outbound.emit('addAuthRevoke', { id: args.id, kind: 'u' })

        return {
          responseResult: graphHelper.generateSuccess('User deactivated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async enableTFA (obj, args) {
      try {
        await WIKI.models.users.query().patch({ tfaIsActive: true, tfaSecret: null }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User 2FA enabled successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async disableTFA (obj, args) {
      try {
        await WIKI.models.users.query().patch({ tfaIsActive: false, tfaSecret: null }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User 2FA disabled successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    resetPassword (obj, args) {
      return false
    },
    async updateProfile (obj, args, context) {
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

        if (!['', 'DD/MM/YYYY', 'DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD'].includes(args.dateFormat)) {
          throw new WIKI.Error.InputInvalid()
        }

        if (!['', 'light', 'dark'].includes(args.appearance)) {
          throw new WIKI.Error.InputInvalid()
        }

        await WIKI.models.users.updateUser({
          id: usr.id,
          name: _.trim(args.name),
          jobTitle: _.trim(args.jobTitle),
          location: _.trim(args.location),
          timezone: args.timezone,
          dateFormat: args.dateFormat,
          appearance: args.appearance
        })

        const newToken = await WIKI.models.users.refreshToken(usr.id)

        return {
          responseResult: graphHelper.generateSuccess('User profile updated successfully'),
          jwt: newToken.token
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
  },
  UserProfile: {
    async groups (usr) {
      const usrGroups = await usr.$relatedQuery('groups')
      return usrGroups.map(g => g.name)
    },
    async pagesTotal (usr) {
      const result = await WIKI.models.pages.query().count('* as total').where('creatorId', usr.id).first()
      return _.toSafeInteger(result.total)
    }
  }
}
