const _ = require('lodash')
const fs = require('fs')
// const gqlTools = require('graphql-tools')
const path = require('path')
const autoload = require('auto-load')
const PubSub = require('graphql-subscriptions').PubSub
const { LEVEL, MESSAGE } = require('triple-beam')
const Transport = require('winston-transport')
// const { GraphQLUpload } = require('graphql-upload')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const { authDirectiveTypeDefs, authDirectiveTransformer } = require('./directives/auth')
const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = require('./directives/rate-limit')

/* global WIKI */

WIKI.logger.info(`Loading GraphQL Schema...`)

// Init Subscription PubSub

WIKI.GQLEmitter = new PubSub()

// Schemas
const typeDefs = [authDirectiveTypeDefs, rateLimitDirectiveTypeDefs]
let schemas = fs.readdirSync(path.join(WIKI.SERVERPATH, 'graph/schemas'))
schemas.forEach(schema => {
  typeDefs.push(fs.readFileSync(path.join(WIKI.SERVERPATH, `graph/schemas/${schema}`), 'utf8'))
})

// Resolvers

let resolvers = {
  // Upload: GraphQLUpload
}
const resolversObj = _.values(autoload(path.join(WIKI.SERVERPATH, 'graph/resolvers')))
resolversObj.forEach(resolver => {
  _.merge(resolvers, resolver)
})
// Live Trail Logger (admin)

class LiveTrailLogger extends Transport {
  constructor(opts) {
    super(opts)

    this.name = 'liveTrailLogger'
    this.level = 'debug'
  }

  log (info, callback = () => {}) {
    WIKI.GQLEmitter.publish('livetrail', {
      loggingLiveTrail: {
        timestamp: new Date(),
        level: info[LEVEL],
        output: info[MESSAGE]
      }
    })
    callback(null, true)
  }
}

WIKI.logger.add(new LiveTrailLogger({}))

// Make executable schema

WIKI.logger.info(`Compiling GraphQL Schema...`)

let schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

// Apply schema transforms

schema = authDirectiveTransformer(schema)
schema = rateLimitDirectiveTransformer(schema)

WIKI.logger.info(`GraphQL Schema: [ OK ]`)

module.exports = schema
