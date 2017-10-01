const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')

/* global wiki */

module.exports = {
  Query: {
    authentication(obj, args, context, info) {
      switch (args.mode) {
        case 'active':
          let strategies = _.chain(wiki.auth.strategies).map(str => {
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
  Mutation: {},
  AuthenticationProvider: {
    icon (ap, args) {
      return fs.readFileAsync(path.join(wiki.ROOTPATH, `assets/svg/auth-icon-${ap.key}.svg`), 'utf8').catch(err => {
        if (err.code === 'ENOENT') {
          return null
        }
        throw err
      })
    }
  }
}
