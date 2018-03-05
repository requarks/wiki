const _ = require('lodash')
const fs = require('fs')
const gqlTools = require('graphql-tools')
const path = require('path')
const autoload = require('auto-load')

/* global WIKI */

WIKI.logger.info(`Loading GraphQL Schema...`)

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

const Schema = gqlTools.makeExecutableSchema({
  typeDefs,
  resolvers
})

WIKI.logger.info(`GraphQL Schema: [ OK ]`)

module.exports = Schema
