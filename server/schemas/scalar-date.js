
const gql = require('graphql')

module.exports = {
  Date: new gql.GraphQLScalarType({
    name: 'Date',
    description: 'ISO date-time string at UTC',
    parseValue(value) {
      return new Date(value)
    },
    serialize(value) {
      return value.toISOString()
    },
    parseLiteral(ast) {
      if (ast.kind !== gql.Kind.STRING) {
        throw new TypeError('Date value must be an string!')
      }
      return new Date(ast.value)
    }
  })
}
