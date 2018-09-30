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
      let strategies = await WIKI.models.authentication.getStrategies()
      strategies = strategies.map(stg => {
        const strategyInfo = _.find(WIKI.data.authentication, ['key', stg.key]) || {}
        return {
          ...strategyInfo,
          ...stg,
          config: _.sortBy(_.transform(stg.config, (res, value, key) => {
            const configData = _.get(strategyInfo.props, key, {})
            res.push({
              key,
              value: JSON.stringify({
                ...configData,
                value
              })
            })
          }, []), 'key')
        }
      })
      if (args.filter) { strategies = graphHelper.filter(strategies, args.filter) }
      if (args.orderBy) { strategies = graphHelper.orderBy(strategies, args.orderBy) }
      return strategies
    }
  },
  AuthenticationMutation: {
    async login(obj, args, context) {
      try {
        let authResult = await WIKI.models.users.login(args, context)
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
        let authResult = await WIKI.models.users.loginTFA(args, context)
        return {
          ...authResult,
          responseResult: graphHelper.generateSuccess('TFA success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateStrategies(obj, args, context) {
      try {
        for (let str of args.strategies) {
          await WIKI.models.authentication.query().patch({
            isEnabled: str.isEnabled,
            config: _.reduce(str.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {}),
            selfRegistration: str.selfRegistration,
            domainWhitelist: { v: str.domainWhitelist },
            autoEnrollGroups: { v: str.autoEnrollGroups }
          }).where('key', str.key)
        }
        return {
          responseResult: graphHelper.generateSuccess('Strategies updated successfully')
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
