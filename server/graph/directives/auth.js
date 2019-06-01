const { SchemaDirectiveVisitor } = require('graphql-tools')
const { defaultFieldResolver } = require('graphql')
const _ = require('lodash')

class AuthDirective extends SchemaDirectiveVisitor {
  visitObject(type) {
    this.ensureFieldsWrapped(type)
    type._requiredAuthScopes = this.args.requires
  }
  // Visitor methods for nested types like fields and arguments
  // also receive a details object that provides information about
  // the parent and grandparent types.
  visitFieldDefinition(field, details) {
    this.ensureFieldsWrapped(details.objectType)
    field._requiredAuthScopes = this.args.requires
  }

  visitArgumentDefinition(argument, details) {
    this.ensureFieldsWrapped(details.objectType)
    argument._requiredAuthScopes = this.args.requires
  }

  ensureFieldsWrapped(objectType) {
    // Mark the GraphQLObjectType object to avoid re-wrapping:
    if (objectType._authFieldsWrapped) return
    objectType._authFieldsWrapped = true

    const fields = objectType.getFields()

    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName]
      const { resolve = defaultFieldResolver } = field
      field.resolve = async function (...args) {
        // Get the required scopes from the field first, falling back
        // to the objectType if no scopes is required by the field:
        const requiredScopes = field._requiredAuthScopes || objectType._requiredAuthScopes

        if (!requiredScopes) {
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
    })
  }
}

module.exports = AuthDirective
