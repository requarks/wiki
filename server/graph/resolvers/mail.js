const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async mailConfig(obj, args, context, info) {
      return {
        ...WIKI.config.mail,
        pass: WIKI.config.mail.pass.length > 0 ? '********' : ''
      }
    }
  },
  Mutation: {
    async sendMailTest(obj, args, context) {
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
          operation: graphHelper.generateSuccess('Test email sent successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateMailConfig(obj, args, context) {
      try {
        WIKI.config.mail = {
          senderName: args.senderName,
          senderEmail: args.senderEmail,
          host: args.host,
          port: args.port,
          name: args.name,
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
          operation: graphHelper.generateSuccess('Mail configuration updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
