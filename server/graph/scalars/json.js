const { Kind, GraphQLScalarType } = require('graphql')

function ensureObject (value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`JSONObject cannot represent non-object value: ${value}`)
  }

  return value
}

function parseLiteral (typeName, ast, variables) {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return parseFloat(ast.value)
    case Kind.OBJECT:
      return parseObject(typeName, ast, variables)
    case Kind.LIST:
      return ast.values.map((n) => parseLiteral(typeName, n, variables))
    case Kind.NULL:
      return null
    case Kind.VARIABLE:
      return variables ? variables[ast.name.value] : undefined
    default:
      throw new TypeError(`${typeName} cannot represent value: ${ast}`)
  }
}

function parseObject (typeName, ast, variables) {
  const value = Object.create(null)
  ast.fields.forEach((field) => {
    // eslint-disable-next-line no-use-before-define
    value[field.name.value] = parseLiteral(typeName, field.value, variables)
  })

  return value
}

module.exports = {
  JSON: new GraphQLScalarType({
    name: 'JSON',
    description:
      'The `JSON` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).',
    specifiedByUrl:
      'http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf',
    serialize: ensureObject,
    parseValue: ensureObject,
    parseLiteral: (ast, variables) => {
      if (ast.kind !== Kind.OBJECT) {
        throw new TypeError(`JSONObject cannot represent non-object value: ${ast}`)
      }

      return parseObject('JSONObject', ast, variables)
    }
  })
}
