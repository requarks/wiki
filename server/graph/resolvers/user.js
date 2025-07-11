const graphHelper = require('../../helpers/graph')
const _ = require('lodash')
const userService = require('../services/userService')

/* global WIKI */

module.exports = {
  Query: {
    async listUsers(obj, args, context, info) {
      return WIKI.models.users.query()
        .select('id', 'email', 'name', 'providerKey', 'isSystem', 'isActive', 'createdAt')
    },
    async searchUsers(obj, args, context, info) {
      return WIKI.models.users.query()
        .where('email', 'like', `%${args.query}%`)
        .orWhere('name', 'like', `%${args.query}%`)
        .limit(10)
        .select('id', 'email', 'name', 'providerKey', 'createdAt')
    },

    async profile(obj, args, context, info) {
      if (!context.req.user || context.req.user.id < 1 || context.req.user.id === 2) {
        throw new WIKI.Error.AuthRequired()
      }
      const usr = await WIKI.models.users.query().findById(context.req.user.id)
      if (!usr.isActive) {
        throw new WIKI.Error.AuthAccountBanned()
      }

      const providerInfo = _.get(WIKI.auth.strategies, usr.providerKey, {})

      usr.providerName = providerInfo.displayName || 'Unknown'
      usr.password = ''
      usr.providerId = ''
      usr.tfaSecret = ''

      return usr
    },
    async autoCompleteEmails(obj, args, context) {
      const { siteId, query } = args

      // Validate the search text: should contain only allowed characters in an email address
      const emailRegex = /^[a-zA-Z0-9._%+-@]*$/
      if (!emailRegex.test(query) || query.trim() === '' || /^[%_]+$/.test(query)) {
        return []
      }

      // Check if the request user has access to the site
      const userHasAccess = WIKI.auth.checkAccess(context.req.user, ['read:pages', 'manage:sites'], { siteId })
      if (!userHasAccess) {
        throw new WIKI.Error.SiteForbidden()
      }

      try {
        // Prepare the query to search emails
        const emails = await WIKI.models.users.query()
          .distinct('users.email')
          .join('userGroups', 'userGroups.userId', 'users.id')
          .whereIn('userGroups.groupId', function () {
            this.select('id')
              .from('groups')
              .whereRaw('rules::jsonb @> ?', JSON.stringify([{ sites: [siteId], deny: false, roles: ['read:pages'] }]))
              .orWhereRaw('rules::jsonb @> ?', JSON.stringify([{ sites: [siteId], deny: false, roles: ['manage:sites'] }]))
          })
          .andWhereRaw('LOWER(users.email) LIKE ?', `${query.toLowerCase()}%`)

        // Extract only the email addresses
        const emailAddresses = [...new Set(emails.map(user => user.email))]

        return emailAddresses
      } catch (error) {
        throw new Error(`Failed to fetch email addresses: ${error.message}`)
      }
    },
    async userById(obj, args, context, info) {
      let usr = await WIKI.models.users.query().findById(args.id)
      usr.password = ''
      usr.tfaSecret = ''

      const str = _.get(WIKI.auth.strategies, usr.providerKey)
      str.strategy = _.find(WIKI.data.authentication, ['key', str.strategyKey])
      usr.providerName = str.displayName
      usr.providerIs2FACapable = _.get(str, 'strategy.useForm', false)

      return usr
    }
  },
  Mutation: {
    async users() { return {} }
  },
  UserMutation: {
    async create(obj, args) {
      try {
        await WIKI.models.users.createNewUser(args)

        return {
          responseResult: graphHelper.generateSuccess('User created successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async delete(obj, args) {
      try {
        if (args.id <= 2) {
          throw new WIKI.Error.UserDeleteProtected()
        }

        const user = await WIKI.models.users.query().findById(args.id)
        const mentionedPages = await WIKI.models.userMentions.getMentionedPages(args.id)
        const mentionedComments = await WIKI.models.userMentions.getMentionedComments(args.id)
        const userComments = await WIKI.models.comments.query().where('authorId', args.id)

        await WIKI.models.users.deleteUser(args.id, args.replaceId)
        await userService.revokeUserTokens(args.id)

        await WIKI.models.pageHistory.anonymizeMentionsByPageIds(
          mentionedPages.map(mp => mp.pageId),
          (content, contentType) => userService.anonymizeUserMentions(content, contentType, user.email)
        )

        await userService.renderMentionedPages(mentionedPages)
        await userService.anonymizeComments(user, mentionedComments, userComments)

        return {
          responseResult: graphHelper.generateSuccess('User deleted successfully')
        }
      } catch (err) {
        return userService.handleDeleteError(err)
      }
    },
    async update(obj, args) {
      try {
        await WIKI.models.users.updateUser(args)

        return {
          responseResult: graphHelper.generateSuccess('User created successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async verify(obj, args) {
      try {
        await WIKI.models.users.query().patch({ isVerified: true }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User verified successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async activate(obj, args) {
      try {
        await WIKI.models.users.query().patch({ isActive: true }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User activated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deactivate(obj, args) {
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
    async enableTFA(obj, args) {
      try {
        await WIKI.models.users.query().patch({ tfaIsActive: true, tfaSecret: null }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User 2FA enabled successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async disableTFA(obj, args) {
      try {
        await WIKI.models.users.query().patch({ tfaIsActive: false, tfaSecret: null }).findById(args.id)

        return {
          responseResult: graphHelper.generateSuccess('User 2FA disabled successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    resetPassword(obj, args) {
      return false
    },
    async updateProfile(obj, args, context) {
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
          name: WIKI.auth.isSuperAdmin(context.req.user) ? _.trim(args.name) : usr.name,
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
    async changePassword(obj, args, context) {
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
    groups(usr) {
      return usr.$relatedQuery('groups')
    }
  },
  UserProfile: {
    async groups(usr) {
      const usrGroups = await usr.$relatedQuery('groups')
      return usrGroups.map(g => g.name)
    },
    async pagesTotal(usr) {
      const result = await WIKI.models.pages.query().count('* as total').where('creatorId', usr.id).first()
      return _.toSafeInteger(result.total)
    }
  }
}
