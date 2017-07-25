'use strict'

/* global wiki */

const gql = require('graphql')

const User = new gql.GraphQLObjectType({
  name: 'User',
  description: 'A User',
  fields() {
    return {
      id: {
        type: gql.GraphQLInt,
        resolve(usr) {
          return usr.id
        }
      },
      email: {
        type: gql.GraphQLString,
        resolve(usr) {
          return usr.email
        }
      },
      provider: {
        type: gql.GraphQLString,
        resolve(usr) {
          return usr.provider
        }
      },
      providerId: {
        type: gql.GraphQLString,
        resolve(usr) {
          return usr.providerId
        }
      }
    }
  }
})

const Query = new gql.GraphQLObjectType({
  name: 'Query',
  description: 'Root Query',
  fields() {
    return {
      users: {
        type: new gql.GraphQLList(User),
        args: {
          id: {
            type: gql.GraphQLInt
          },
          email: {
            type: gql.GraphQLString
          }
        },
        resolve(root, args) {
          return wiki.db.User.findAll({ where: args })
        }
      }
    }
  }
})

const Schema = new gql.GraphQLSchema({
  query: Query
})

module.exports = Schema
