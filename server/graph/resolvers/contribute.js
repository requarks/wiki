const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async contribute() { return {} }
  },
  ContributeQuery: {
    async contributors(obj, args, context, info) {
      try {
        const resp = await fetch('https://graph.requarks.io', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: '{\n  sponsors {\n    list(kind: BACKER) {\n      id\n      source\n      name\n      joined\n      website\n      twitter\n      avatar\n    }\n  }\n}\n',
            variables: {}
          })
        })
        const respBody = await resp.json()
        return _.get(respBody, 'data.sponsors.list', [])
      } catch (err) {
        WIKI.logger.warn(err)
      }
    }
  }
}
