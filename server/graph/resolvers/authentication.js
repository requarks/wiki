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
    providers(obj, args, context, info) {
      let prv = _.map(WIKI.auth.strategies, str => ({
        isEnabled: true,
        key: str.key,
        props: str.props,
        title: str.title,
        useForm: str.useForm,
        config: []
      }))
      if (args.filter) { prv = graphHelper.filter(prv, args.filter) }
      if (args.orderBy) { prv = graphHelper.orderBy(prv, args.orderBy) }
      return prv
    }
  },
  AuthenticationMutation: {
    async login(obj, args, context) {
      try {
        let authResult = await WIKI.db.User.login(args, context)
        return {
          ...authResult,
          operation: graphHelper.generateSuccess('Login success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async loginTFA(obj, args, context) {
      try {
        let authResult = await WIKI.db.User.loginTFA(args, context)
        return {
          ...authResult,
          operation: graphHelper.generateSuccess('TFA success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  AuthenticationProvider: {
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
