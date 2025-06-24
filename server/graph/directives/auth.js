const { mapSchema, getDirective, MapperKind } = require('@graphql-tools/utils')
const { defaultFieldResolver } = require('graphql')
const _ = require('lodash')

const authDirectiveTypeDefs = /* GraphQL */ `
  directive @auth(requires: [String]) on FIELD_DEFINITION | ARGUMENT_DEFINITION
`

function checkAuth(requiredScopes, context) {
  const user = context.req?.user
  if (!user) {
    throw new Error('Unauthorized')
  }

  if (!requiredScopes) {
    return
  }
  if (!_.some(user.permissions, pm => _.includes(requiredScopes, pm))) {
    throw new Error('Forbidden')
  }
}

function authDirectiveTransformer(schema, directiveName = 'auth') {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, directiveName)?.[0]
      const argAuthDirectives = {}
      if (fieldConfig.args) {
        for (const [argName, argConfig] of Object.entries(fieldConfig.args)) {
          const argDirective = getDirective(schema, argConfig, directiveName)?.[0]
          if (argDirective) argAuthDirectives[argName] = argDirective.requires
        }
      }
      // If no @auth on field or arguments, skip
      if (!authDirective && Object.keys(argAuthDirectives).length === 0) return fieldConfig

      // Use the field's resolver if present, otherwise defaultFieldResolver
      const originalResolve = fieldConfig.resolve || defaultFieldResolver
      fieldConfig.resolve = async function (source, args, context, info) {
        // Field-level @auth
        if (authDirective) checkAuth(authDirective.requires, context)
        // Argument-level @auth
        for (const [argName, requiredScopes] of Object.entries(argAuthDirectives)) {
          if (args[argName] !== undefined) {
            checkAuth(requiredScopes, context)
          }
        }
        return originalResolve.apply(this, [source, args, context, info])
      }
      return fieldConfig
    }
  })
}

module.exports = {
  authDirectiveTypeDefs,
  authDirectiveTransformer
}
