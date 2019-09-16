const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async logging() { return {} }
  },
  Mutation: {
    async logging() { return {} }
  },
  Subscription: {
    loggingLiveTrail: {
      subscribe: () => WIKI.GQLEmitter.asyncIterator('livetrail')
    }
  },
  LoggingQuery: {
    async loggers(obj, args, context, info) {
      let loggers = await WIKI.models.loggers.getLoggers()
      loggers = loggers.map(logger => {
        const loggerInfo = _.find(WIKI.data.loggers, ['key', logger.key]) || {}
        return {
          ...loggerInfo,
          ...logger,
          config: _.sortBy(_.transform(logger.config, (res, value, key) => {
            const configData = _.get(loggerInfo.props, key, {})
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
      // if (args.filter) { loggers = graphHelper.filter(loggers, args.filter) }
      if (args.orderBy) { loggers = _.sortBy(loggers, [args.orderBy]) }
      return loggers
    }
  },
  LoggingMutation: {
    async updateLoggers(obj, args, context) {
      try {
        for (let logger of args.loggers) {
          await WIKI.models.loggers.query().patch({
            isEnabled: logger.isEnabled,
            level: logger.level,
            config: _.reduce(logger.config, (result, value, key) => {
              _.set(result, `${value.key}`, value.value)
              return result
            }, {})
          }).where('key', logger.key)
        }
        return {
          responseResult: graphHelper.generateSuccess('Loggers updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
