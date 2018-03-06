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
      return _.chain(WIKI.auth.strategies).map(str => {
        return {
          isEnabled: true,
          key: str.key,
          props: str.props,
          title: str.title,
          useForm: str.useForm,
          config: []
        }
      }).sortBy(['title']).value()
    }
  },
  AuthenticationProvider: {
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
