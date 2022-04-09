const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const autoload = require('auto-load')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const { rateLimitDirective } = require('graphql-rate-limit-directive')
const { GraphQLUpload } = require('graphql-upload')
const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective()

/* global WIKI */

WIKI.logger.info(`Loading GraphQL Schema...`)

// Schemas

const typeDefs = [
  rateLimitDirectiveTypeDefs
]
const schemas = fs.readdirSync(path.join(WIKI.SERVERPATH, 'graph/schemas'))
schemas.forEach(schema => {
  typeDefs.push(fs.readFileSync(path.join(WIKI.SERVERPATH, `graph/schemas/${schema}`), 'utf8'))
})

// Resolvers

let resolvers = {
  Upload: GraphQLUpload
}
const resolversObj = _.values(autoload(path.join(WIKI.SERVERPATH, 'graph/resolvers')))
resolversObj.forEach(resolver => {
  _.merge(resolvers, resolver)
})

// Make executable schema

let schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

schema = rateLimitDirectiveTransformer(schema)

WIKI.logger.info(`GraphQL Schema: [ OK ]`)

module.exports = schema
