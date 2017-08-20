'use strict'

/* global wiki */

const gqlTools = require('graphql-tools')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const typeDefs = fs.readFileSync(path.join(wiki.SERVERPATH, 'schemas/types.graphql'), 'utf8')

const DateScalar = require('../schemas/scalar-date')
const CommentResolvers = require('../schemas/resolvers-comment')
const DocumentResolvers = require('../schemas/resolvers-document')
const FolderResolvers = require('../schemas/resolvers-folder')
const GroupResolvers = require('../schemas/resolvers-group')
const SettingResolvers = require('../schemas/resolvers-setting')
const TagResolvers = require('../schemas/resolvers-tag')
const UserResolvers = require('../schemas/resolvers-user')

const resolvers = _.merge(
  CommentResolvers,
  DocumentResolvers,
  FolderResolvers,
  GroupResolvers,
  SettingResolvers,
  TagResolvers,
  UserResolvers,
  DateScalar
)

const Schema = gqlTools.makeExecutableSchema({
  typeDefs,
  resolvers
})

module.exports = Schema
