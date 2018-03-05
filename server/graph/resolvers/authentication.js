const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')

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
      switch (args.mode) {
        case 'active':
          let strategies = _.chain(WIKI.auth.strategies).map(str => {
            return {
              key: str.key,
              title: str.title,
              useForm: str.useForm
            }
          }).sortBy(['title']).value()
          let localStrategy = _.remove(strategies, str => str.key === 'local')
          return _.concat(localStrategy, strategies)
        case 'all':

          break
        default:
          return null
      }
    }
  },
  AuthenticationProvider: {
    icon (ap, args) {
      return fs.readFileAsync(path.join(WIKI.ROOTPATH, `assets/svg/auth-icon-${ap.key}.svg`), 'utf8').catch(err => {
        if (err.code === 'ENOENT') {
          return null
        }
        throw err
      })
    }
  }
}
