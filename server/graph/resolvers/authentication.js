const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async authentication () { return {} }
  },
  Mutation: {
    async authentication () { return {} }
  },
  AuthenticationQuery: {
    /**
     * Fetch active authentication strategies
     */
    async strategies (obj, args, context, info) {
      let strategies = await WIKI.models.authentication.getStrategies(args.isEnabled)
      strategies = strategies.map(stg => {
        const strategyInfo = _.find(WIKI.data.authentication, ['key', stg.key]) || {}
        return {
          ...strategyInfo,
          ...stg,
          config: _.sortBy(_.transform(stg.config, (res, value, key) => {
            const configData = _.get(strategyInfo.props, key, false)
            if (configData) {
              res.push({
                key,
                value: JSON.stringify({
                  ...configData,
                  value
                })
              })
            }
          }, []), 'key')
        }
      })
      return strategies
    }
  },
  AuthenticationMutation: {
    /**
     * Perform Login
     */
    async login (obj, args, context) {
      try {
        const authResult = await WIKI.models.users.login(args, context)
        return {
          ...authResult,
          responseResult: graphHelper.generateSuccess('Login success')
        }
      } catch (err) {
        // LDAP Debug Flag
        if (args.strategy === 'ldap' && WIKI.config.flags.ldapdebug) {
          WIKI.logger.warn('LDAP LOGIN ERROR (c1): ', err)
        }

        return graphHelper.generateError(err)
      }
    },
    /**
     * Perform 2FA Login
     */
    async loginTFA (obj, args, context) {
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
    /**
     * Perform Mandatory Password Change after Login
     */
    async loginChangePassword (obj, args, context) {
      try {
        const authResult = await WIKI.models.users.loginChangePassword(args, context)
        return {
          ...authResult,
          responseResult: graphHelper.generateSuccess('Password changed successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Register a new account
     */
    async register (obj, args, context) {
      try {
        await WIKI.models.users.register({ ...args, verify: true }, context)
        return {
          responseResult: graphHelper.generateSuccess('Registration success')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Update Authentication Strategies
     */
    async updateStrategies (obj, args, context) {
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
    },
    /**
     * Generate New Authentication Public / Private Key Certificates
     */
    async regenerateCertificates (obj, args, context) {
      try {
        await WIKI.auth.regenerateCertificates()
        return {
          responseResult: graphHelper.generateSuccess('Certificates have been regenerated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Reset Guest User
     */
    async resetGuestUser (obj, args, context) {
      try {
        await WIKI.auth.resetGuestUser()
        return {
          responseResult: graphHelper.generateSuccess('Guest user has been reset successfully.')
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
