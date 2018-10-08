const _ = require('lodash')
const fs = require('fs')
// const gqlTools = require('graphql-tools')
const path = require('path')
const autoload = require('auto-load')
const PubSub = require('graphql-subscriptions').PubSub
const util = require('util')
const winston = require('winston')

/* global WIKI */

WIKI.logger.info(`Loading GraphQL Schema...`)

// Init Subscription PubSub

WIKI.GQLEmitter = new PubSub()

// Schemas

let typeDefs = []
let schemas = fs.readdirSync(path.join(WIKI.SERVERPATH, 'graph/schemas'))
schemas.forEach(schema => {
  typeDefs.push(fs.readFileSync(path.join(WIKI.SERVERPATH, `graph/schemas/${schema}`), 'utf8'))
})

// Resolvers

let resolvers = {}
const resolversObj = _.values(autoload(path.join(WIKI.SERVERPATH, 'graph/resolvers')))
resolversObj.forEach(resolver => {
  _.merge(resolvers, resolver)
})

// Directives

let schemaDirectives = autoload(path.join(WIKI.SERVERPATH, 'graph/directives'))

// Live Trail Logger (admin)

let LiveTrailLogger = winston.transports.LiveTrailLogger = function (options) {
  this.name = 'livetrailLogger'
  this.level = 'debug'
}
util.inherits(LiveTrailLogger, winston.Transport)
LiveTrailLogger.prototype.log = function (level, msg, meta, callback) {
  WIKI.GQLEmitter.publish('livetrail', {
    loggingLiveTrail: {
      timestamp: new Date(),
      level,
      output: msg
    }
  })
  callback(null, true)
}

WIKI.logger.add(new LiveTrailLogger({}))

WIKI.logger.info(`GraphQL Schema: [ OK ]`)

module.exports = {
  typeDefs,
  resolvers,
  schemaDirectives
}
