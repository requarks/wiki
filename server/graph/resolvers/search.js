const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async search() { return {} }
  },
  Mutation: {
    async search() { return {} }
  },
  SearchQuery: {
    async searchEngines(obj, args, context, info) {
      let searchEngines = await WIKI.models.searchEngines.getSearchEngines()
      searchEngines = searchEngines.map(searchEngine => {
        const searchEngineInfo = _.find(WIKI.data.searchEngines, ['key', searchEngine.key]) || {}
        return {
          ...searchEngineInfo,
          ...searchEngine,
          config: _.sortBy(_.transform(searchEngine.config, (res, value, key) => {
            const configData = _.get(searchEngineInfo.props, key, false)
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
      // if (args.filter) { searchEngines = graphHelper.filter(searchEngines, args.filter) }
      if (args.orderBy) { searchEngines = _.sortBy(searchEngines, [args.orderBy]) }
      return searchEngines
    }
  },
  SearchMutation: {
    async updateSearchEngines(obj, args, context) {
      try {
        let newActiveEngine = ''
        for (let searchEngine of args.engines) {
          if (searchEngine.isEnabled) {
            newActiveEngine = searchEngine.key
          }
          await WIKI.models.searchEngines.query().patch({
            isEnabled: searchEngine.isEnabled,
            config: _.reduce(searchEngine.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {})
          }).where('key', searchEngine.key)
        }
        if (newActiveEngine !== WIKI.data.searchEngine.key) {
          try {
            await WIKI.data.searchEngine.deactivate()
          } catch (err) {
            WIKI.logger.warn('Failed to deactivate previous search engine:', err)
          }
        }
        await WIKI.models.searchEngines.initEngine({ activate: true })
        return {
          responseResult: graphHelper.generateSuccess('Search Engines updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async rebuildIndex (obj, args, context) {
      try {
        await WIKI.data.searchEngine.rebuild()
        return {
          responseResult: graphHelper.generateSuccess('Index rebuilt successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
