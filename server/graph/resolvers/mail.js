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
      return {
        ...WIKI.config.mail,
        pass: WIKI.config.mail.pass.length > 0 ? '********' : ''
      }
    }
  },
  MailMutation: {
    async sendTest(obj, args, context) {
      try {
        if (_.isEmpty(args.recipientEmail) || args.recipientEmail.length < 6) {
          throw new WIKI.Error.MailInvalidRecipient()
        }

        await WIKI.mail.send({
          template: 'test',
          to: args.recipientEmail,
          subject: 'A test email from your wiki',
          text: 'This is a test email sent from your wiki.',
          data: {
            preheadertext: 'This is a test email sent from your wiki.'
          }
        })

        return {
          responseResult: graphHelper.generateSuccess('Test email sent successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateConfig(obj, args, context) {
      try {
        WIKI.config.mail = {
          senderName: args.senderName,
          senderEmail: args.senderEmail,
          host: args.host,
          port: args.port,
          secure: args.secure,
          verifySSL: args.verifySSL,
          user: args.user,
          pass: (args.pass === '********') ? WIKI.config.mail.pass : args.pass,
          useDKIM: args.useDKIM,
          dkimDomainName: args.dkimDomainName,
          dkimKeySelector: args.dkimKeySelector,
          dkimPrivateKey: args.dkimPrivateKey
        }
        await WIKI.configSvc.saveToDb(['mail'])

        WIKI.mail.init()

        return {
          responseResult: graphHelper.generateSuccess('Mail configuration updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
