const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async storage() { return {} }
  },
  Mutation: {
    async storage() { return {} }
  },
  StorageQuery: {
    async targets(obj, args, context, info) {
      let targets = await WIKI.models.storage.getTargets()
      targets = _.sortBy(targets.map(tgt => {
        const targetInfo = _.find(WIKI.data.storage, ['key', tgt.key]) || {}
        return {
          ...targetInfo,
          ...tgt,
          hasSchedule: (targetInfo.schedule !== false),
          syncInterval: tgt.syncInterval || targetInfo.schedule || 'P0D',
          syncIntervalDefault: targetInfo.schedule,
          config: _.sortBy(_.transform(tgt.config, (res, value, key) => {
            const configData = _.get(targetInfo.props, key, false)
            if (configData) {
              res.push({
                key,
                value: JSON.stringify({
                  ...configData,
                  value: (configData.sensitive && value.length > 0) ? '********' : value
                })
              })
            }
          }, []), 'key')
        }
      }), ['title', 'key'])
      return targets
    },
    async status(obj, args, context, info) {
      let activeTargets = await WIKI.models.storage.query().where('isEnabled', true)
      return activeTargets.map(tgt => {
        const targetInfo = _.find(WIKI.data.storage, ['key', tgt.key]) || {}
        return {
          key: tgt.key,
          title: targetInfo.title,
          status: _.get(tgt, 'state.status', 'pending'),
          message: _.get(tgt, 'state.message', 'Initializing...'),
          lastAttempt: _.get(tgt, 'state.lastAttempt', null)
        }
      })
    }
  },
  StorageMutation: {
    async updateTargets(obj, args, context) {
      try {
        let dbTargets = await WIKI.models.storage.getTargets()
        for (let tgt of args.targets) {
          const currentDbTarget = _.find(dbTargets, ['key', tgt.key])
          if (!currentDbTarget) {
            continue
          }
          await WIKI.models.storage.query().patch({
            isEnabled: tgt.isEnabled,
            mode: tgt.mode,
            syncInterval: tgt.syncInterval,
            config: _.reduce(tgt.config, (result, value, key) => {
              let configValue = _.get(JSON.parse(value.value), 'v', null)
              if (configValue === '********') {
                configValue = _.get(currentDbTarget.config, value.key, '')
              }
              _.set(result, `${value.key}`, configValue)
              return result
            }, {}),
            state: {
              status: 'pending',
              message: 'Initializing...',
              lastAttempt: null
            }
          }).where('key', tgt.key)
        }
        await WIKI.models.storage.initTargets()
        return {
          responseResult: graphHelper.generateSuccess('Storage targets updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async executeAction(obj, args, context) {
      try {
        await WIKI.models.storage.executeAction(args.targetKey, args.handler)
        return {
          responseResult: graphHelper.generateSuccess('Action completed.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
