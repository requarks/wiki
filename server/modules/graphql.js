'use strict'

/* global wiki */

const gqlTools = require('graphql-tools')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const typeDefs = fs.readFileSync(path.join(wiki.SERVERPATH, 'schemas/types.graphql'), 'utf8')

const DateScalar = require('../schemas/scalar-date')
const GroupResolvers = require('../schemas/resolvers-group')
const UserResolvers = require('../schemas/resolvers-user')

const resolvers = _.merge(
  GroupResolvers,
  UserResolvers,
  DateScalar
)

const Schema = gqlTools.makeExecutableSchema({
  typeDefs,
  resolvers
})

module.exports = Schema
