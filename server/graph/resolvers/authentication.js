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
     * List of API Keys
     */
    async apiKeys (obj, args, context) {
      const keys = await WIKI.models.apiKeys.query().orderBy(['isRevoked', 'name'])
      return keys.map(k => ({
        id: k.id,
        name: k.name,
        keyShort: '...' + k.key.substring(k.key.length - 20),
        isRevoked: k.isRevoked,
        expiration: k.expiration,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
      }))
    },
    /**
     * Current API State
     */
    apiState () {
      return WIKI.config.api.isEnabled
    },
    async strategies () {
      return WIKI.data.authentication.map(stg => ({
        ...stg,
        isAvailable: stg.isAvailable === true,
        props: _.sortBy(_.transform(stg.props, (res, value, key) => {
          res.push({
            key,
            value: JSON.stringify(value)
          })
        }, []), 'key')
      }))
    },
    /**
     * Fetch active authentication strategies
     */
    async activeStrategies (obj, args, context, info) {
      let strategies = await WIKI.models.authentication.getStrategies()
      strategies = strategies.map(stg => {
        const strategyInfo = _.find(WIKI.data.authentication, ['key', stg.strategyKey]) || {}
        return {
          ...stg,
          strategy: strategyInfo,
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
      return args.enabledOnly ? _.filter(strategies, 'isEnabled') : strategies
    }
  },
  AuthenticationMutation: {
    /**
     * Create New API Key
     */
    async createApiKey (obj, args, context) {
      try {
        const key = await WIKI.models.apiKeys.createNewKey(args)
        await WIKI.auth.reloadApiKeys()
        WIKI.events.outbound.emit('reloadApiKeys')
        return {
          key,
          responseResult: graphHelper.generateSuccess('API Key created successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
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
     * Perform Mandatory Password Change after Login
     */
    async forgotPassword (obj, args, context) {
      try {
        await WIKI.models.users.loginForgotPassword(args, context)
        return {
          responseResult: graphHelper.generateSuccess('Password reset request processed.')
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
     * Set API state
     */
    async setApiState (obj, args, context) {
      try {
        WIKI.config.api.isEnabled = args.enabled
        await WIKI.configSvc.saveToDb(['api'])
        return {
          responseResult: graphHelper.generateSuccess('API State changed successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Revoke an API key
     */
    async revokeApiKey (obj, args, context) {
      try {
        await WIKI.models.apiKeys.query().findById(args.id).patch({
          isRevoked: true
        })
        await WIKI.auth.reloadApiKeys()
        WIKI.events.outbound.emit('reloadApiKeys')
        return {
          responseResult: graphHelper.generateSuccess('API Key revoked successfully')
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
        const previousStrategies = await WIKI.models.authentication.getStrategies()
        for (const str of args.strategies) {
          const newStr = {
            displayName: str.displayName,
            order: str.order,
            isEnabled: str.isEnabled,
            config: _.reduce(str.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {}),
            selfRegistration: str.selfRegistration,
            domainWhitelist: { v: str.domainWhitelist },
            autoEnrollGroups: { v: str.autoEnrollGroups }
          }

          if (_.some(previousStrategies, ['key', str.key])) {
            await WIKI.models.authentication.query().patch({
              key: str.key,
              strategyKey: str.strategyKey,
              ...newStr
            }).where('key', str.key)
          } else {
            await WIKI.models.authentication.query().insert({
              key: str.key,
              strategyKey: str.strategyKey,
              ...newStr
            })
          }
        }

        for (const str of _.differenceBy(previousStrategies, args.strategies, 'key')) {
          const hasUsers = await WIKI.models.users.query().count('* as total').where({ providerKey: str.key }).first()
          if (_.toSafeInteger(hasUsers.total) > 0) {
            throw new Error(`Cannot delete ${str.displayName} as 1 or more users are still using it.`)
          } else {
            await WIKI.models.authentication.query().delete().where('key', str.key)
          }
        }

        await WIKI.auth.activateStrategies()
        WIKI.events.outbound.emit('reloadAuthStrategies')
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
