const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async mail() { return {} }
  },
  Mutation: {
    async mail() { return {} }
  },
  MailQuery: {
    async config(obj, args, context, info) {
      return WIKI.config.mail
    }
  },
  MailMutation: {
    async updateConfig(obj, args, context) {
      try {
        WIKI.config.mail = {
          senderName: args.senderName,
          senderEmail: args.senderEmail,
          host: args.host,
          port: args.port,
          secure: args.secure,
          user: args.user,
          pass: args.pass,
          useDKIM: args.useDKIM,
          dkimDomainName: args.dkimDomainName,
          dkimKeySelector: args.dkimKeySelector,
          dkimPrivateKey: args.dkimPrivateKey,
        }
        await WIKI.configSvc.saveToDb(['mail'])

        WIKI.mail.init()

        return {
          responseResult: graphHelper.generateSuccess('Mail configuration updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
