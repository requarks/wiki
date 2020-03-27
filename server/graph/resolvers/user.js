const graphHelper = require('../../helpers/graph')

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
        .select('id', 'email', 'name', 'providerKey', 'isSystem', 'createdAt')
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
      return usr
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
        await WIKI.models.users.deleteUser(args.id)
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

        return {
          responseResult: graphHelper.generateSuccess('User deactivated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    resetPassword (obj, args) {
      return false
    }
  },
  User: {
    groups(usr) {
      return usr.$relatedQuery('groups')
    }
  }
}
