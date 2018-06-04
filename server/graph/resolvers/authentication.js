const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const graphHelper = require('../../helpers/graph')

// const getFieldNames = require('graphql-list-fields')

/* global WIKI */

module.exports = {
  Query: {
    async authentication() { return {} }
  },
  Mutation: {
    async authentication() { return {} }
  },
  AuthenticationQuery: {
    async strategies(obj, args, context, info) {
      let strategies = await WIKI.db.authentication.query().orderBy('title')
      strategies = strategies.map(stg => ({
        ...stg,
        config: _.transform(stg.config, (res, value, key) => {
          res.push({ key, value })
        }, [])
      }))
      if (args.filter) { strategies = graphHelper.filter(strategies, args.filter) }
      if (args.orderBy) { strategies = graphHelper.orderBy(strategies, args.orderBy) }
      return strategies
    }
  },
  AuthenticationMutation: {
    async login(obj, args, context) {
      try {
        let authResult = await WIKI.db.users.login(args, context)
        return {
          ...authResult,
          responseResult: graphHelper.generateSuccess('Login success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async loginTFA(obj, args, context) {
      try {
        let authResult = await WIKI.db.users.loginTFA(args, context)
        return {
          ...authResult,
          responseResult: graphHelper.generateSuccess('TFA success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  AuthenticationStrategy: {
    icon (ap, args) {
      return fs.readFile(path.join(WIKI.ROOTPATH, `assets/svg/auth-icon-${ap.key}.svg`), 'utf8').catch(err => {
        if (err.code === 'ENOENT') {
          return null
        }
        throw err
      })
    }
  }
}
