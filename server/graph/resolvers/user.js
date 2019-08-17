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
    delete(obj, args) {
      return WIKI.models.users.query().deleteById(args.id)
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
    resetPassword(obj, args) {
      return false
    }
  },
  User: {
    groups(usr) {
      return usr.$relatedQuery('groups')
    }
  }
}
