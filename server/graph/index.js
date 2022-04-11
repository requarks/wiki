const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const autoload = require('auto-load')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const { defaultKeyGenerator, rateLimitDirective } = require('graphql-rate-limit-directive')
const { GraphQLUpload } = require('graphql-upload')

/* global WIKI */

// Rate Limiter

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
  keyGenerator: (directiveArgs, source, args, context, info) => `${context.req.ip}:${defaultKeyGenerator(directiveArgs, source, args, context, info)}`
})

// Schemas

WIKI.logger.info(`Loading GraphQL Schema...`)
const typeDefs = [
  rateLimitDirectiveTypeDefs
]
const schemas = fs.readdirSync(path.join(WIKI.SERVERPATH, 'graph/schemas'))
schemas.forEach(schema => {
  typeDefs.push(fs.readFileSync(path.join(WIKI.SERVERPATH, `graph/schemas/${schema}`), 'utf8'))
})

// Resolvers

WIKI.logger.info(`Loading GraphQL Resolvers...`)
let resolvers = {
  Date: require('./scalars/date'),
  JSON: require('./scalars/json'),
  UUID: require('./scalars/uuid'),
  Upload: GraphQLUpload
}
const resolversObj = _.values(autoload(path.join(WIKI.SERVERPATH, 'graph/resolvers')))
resolversObj.forEach(resolver => {
  _.merge(resolvers, resolver)
})

// Make executable schema

WIKI.logger.info(`Compiling GraphQL Schema...`)
let schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

// Apply schema transforms

schema = rateLimitDirectiveTransformer(schema)

WIKI.logger.info(`GraphQL Schema: [ OK ]`)

module.exports = schema
