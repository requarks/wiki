const { mapSchema, getDirective, MapperKind } = require('@graphql-tools/utils')
const { defaultFieldResolver } = require('graphql')
const _ = require('lodash')

/**
 * Schema transformer for the @auth(requires: [String]) directive.
 * Wraps field resolvers to enforce user permission scopes.
 */
module.exports = (schema) => {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0]
      if (!authDirective) {
        return fieldConfig
      }
      const requiredScopes = authDirective.requires
      const { resolve = defaultFieldResolver } = fieldConfig
      fieldConfig.resolve = async function (...args) {
        if (!requiredScopes || requiredScopes.length < 1) {
          return resolve.apply(this, args)
        }
        const context = args[2]
        if (!context.req.user) {
          throw new Error('Unauthorized')
        }
        if (!_.some(context.req.user.permissions, pm => _.includes(requiredScopes, pm))) {
          throw new Error('Forbidden')
        }
        return resolve.apply(this, args)
      }
      return fieldConfig
    }
  })
}
