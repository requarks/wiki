const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const graphHelper = require('../../helpers/graph')

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
      let strategies = await WIKI.models.authentication.getStrategies(args.isEnabled)
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
      return strategies
    }
  },
  AuthenticationMutation: {
    async login(obj, args, context) {
      try {
        const authResult = await WIKI.models.users.login(args, context)
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
        const authResult = await WIKI.models.users.loginTFA(args, context)
        return {
          ...authResult,
          responseResult: graphHelper.generateSuccess('TFA success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async register(obj, args, context) {
      try {
        await WIKI.models.users.register({...args, verify: true }, context)
        return {
          responseResult: graphHelper.generateSuccess('Registration success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateStrategies(obj, args, context) {
      try {
        WIKI.config.auth = {
          audience: _.get(args, 'config.audience', WIKI.config.auth.audience),
          tokenExpiration: _.get(args, 'config.tokenExpiration', WIKI.config.auth.tokenExpiration),
          tokenRenewal: _.get(args, 'config.tokenRenewal', WIKI.config.auth.tokenRenewal)
        }
        await WIKI.configSvc.saveToDb(['auth'])

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
        await WIKI.auth.activateStrategies()
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
