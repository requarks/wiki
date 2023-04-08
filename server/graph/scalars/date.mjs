import gql from 'graphql'
import { DateTime } from 'luxon'

function parseDateTime (value) {
  const nDate = DateTime.fromISO(value)
  return nDate.isValid ? nDate : null
}

export default new gql.GraphQLScalarType({
  name: 'Date',
  description: 'ISO date-time string at UTC',
  parseValue(value) {
    if (typeof value !== 'string') {
      throw new TypeError('Date value must be an string!')
    }
    return parseDateTime(value)
  },
  serialize(value) {
    return value.toISOString()
  },
  parseLiteral(ast) {
    if (ast.kind !== gql.Kind.STRING) {
      throw new TypeError('Date value must be an string!')
    }
    return parseDateTime(ast.value)
  }
})
